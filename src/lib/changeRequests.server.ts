import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { canApproveChanges } from "@/lib/auth";
import { diffFields } from "@/lib/auditLog";
import { recordAudit } from "@/lib/auditLog.server";
import { isMissingTable } from "@/lib/prismaErrors";
import { runClubBillingAction } from "@/lib/clubBillingApi.server";
import {
  CHANGE_TYPES, billingActionFor, type ChangeType, type PackageEditPayload, type PlanChangePayload,
} from "@/lib/changeRequests";

type Actor = { id: string; name: string; role: string };

// A problem the person can read and act on (a bad value, Stripe saying no, ...).
export class ChangeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Carries out a change. Used both when an admin makes it directly and when an admin approves a
 * request, so there is one way each change happens. Every change is written to the Logs as the
 * person who made or approved it; `note` carries who asked, for approved requests.
 */
export async function executeChange(
  type: ChangeType,
  clubId: string | null,
  payload: unknown,
  actor: Actor,
  note?: string,
): Promise<void> {
  const withNote = (text: string | null) => [text, note].filter(Boolean).join(" · ") || null;

  switch (type) {
    case "PLAN_CHANGE": {
      if (!clubId) throw new ChangeError("A club is required");
      const p = payload as PlanChangePayload;
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, name: true, packageId: true, userCapOverride: true } });
      if (!club) throw new ChangeError("Club not found", 404);
      const data: { packageId?: string | null; userCapOverride?: number | null } = {};
      if ("packageId" in p) {
        if (p.packageId) {
          const pkg = await prisma.package.findUnique({ where: { id: p.packageId }, select: { id: true } });
          if (!pkg) throw new ChangeError("That package doesn't exist");
        }
        data.packageId = p.packageId ?? null;
      }
      if ("userCapOverride" in p) data.userCapOverride = p.userCapOverride ?? null;
      const updated = await prisma.club.update({ where: { id: clubId }, data, select: { packageId: true, userCapOverride: true } });
      await recordAudit(actor, {
        action: "club.edit",
        targetType: "club",
        targetId: clubId,
        targetLabel: club.name,
        changes: diffFields(club, updated, [
          { key: "packageId", label: "Package" },
          { key: "userCapOverride", label: "User cap override" },
        ]),
        note: withNote(null),
      });
      return;
    }

    case "PACKAGE_EDIT": {
      const p = payload as PackageEditPayload;
      const before = await prisma.package.findUnique({ where: { id: p.packageId } });
      if (!before) throw new ChangeError("Package not found", 404);
      const after = await prisma.package.update({
        where: { id: p.packageId },
        data: { name: p.name, userCap: p.userCap, priceCents: p.priceCents, trialDays: p.trialDays, active: p.active },
      });
      await recordAudit(actor, {
        action: "package.edit",
        targetType: "package",
        targetId: p.packageId,
        targetLabel: after.name,
        changes: diffFields(before, after, [
          { key: "name", label: "Name" },
          { key: "priceCents", label: "Price (cents/month)" },
          { key: "userCap", label: "User limit" },
          { key: "trialDays", label: "Trial days" },
          { key: "active", label: "Active" },
        ]),
        note: withNote(null),
      });
      return;
    }

    default: {
      // Account hold, resume and cancel are done in Stripe by the club app.
      const action = billingActionFor(type);
      if (!action || !clubId) throw new ChangeError("Unknown change");
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
      if (!club) throw new ChangeError("Club not found", 404);
      try {
        const months = (payload as { months?: number } | null)?.months;
        await runClubBillingAction(clubId, action, actor.name, { months });
      } catch (e) {
        throw new ChangeError(e instanceof Error ? e.message : "Stripe couldn't make that change", 502);
      }
      await recordAudit(actor, {
        action: "billing.action",
        targetType: "club",
        targetId: clubId,
        targetLabel: club.name,
        note: withNote(`${CHANGE_TYPES[type]} (Stripe confirms shortly)`),
      });
    }
  }
}

export type SubmitResult = { done: true } | { requested: true; id: string };

/**
 * Admins make the change now; anyone else sends a request for an admin to approve. Either way the
 * caller just calls this.
 */
export async function submitChange(
  input: { type: ChangeType; clubId: string | null; payload: unknown; reason: string | null; targetLabel?: string },
  actor: Actor,
): Promise<SubmitResult> {
  if (canApproveChanges(actor.role)) {
    await executeChange(input.type, input.clubId, input.payload, actor, input.reason ? `Reason: ${input.reason}` : undefined);
    return { done: true };
  }

  let targetLabel = input.targetLabel ?? "";
  if (!targetLabel && input.clubId) {
    targetLabel = (await prisma.club.findUnique({ where: { id: input.clubId }, select: { name: true } }))?.name ?? "";
  }
  if (!targetLabel) throw new ChangeError("Couldn't find what this change is about", 404);

  try {
    const request = await prisma.changeRequest.create({
      data: {
        type: input.type,
        clubId: input.clubId,
        targetLabel,
        payload: input.payload as Prisma.InputJsonValue,
        reason: input.reason,
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedByRole: actor.role,
      },
    });
    await recordAudit(actor, {
      action: "request.create",
      targetType: "request",
      targetId: request.id,
      targetLabel,
      note: `${CHANGE_TYPES[input.type]}${input.reason ? ` · Reason: ${input.reason}` : ""}`,
    });
    return { requested: true, id: request.id };
  } catch (e) {
    if (isMissingTable(e)) throw new ChangeError("Requests aren't available yet: the database update hasn't been run.", 503);
    throw e;
  }
}

/** An admin approves (the change is made now) or rejects a pending request. */
export async function decideChange(
  id: string,
  decision: "approve" | "reject",
  decisionNote: string | null,
  actor: Actor,
): Promise<{ status: "APPROVED" | "REJECTED" | "FAILED"; error?: string }> {
  if (!canApproveChanges(actor.role)) throw new ChangeError("Only super admins and admins can approve or reject changes.", 403);

  const request = await prisma.changeRequest.findUnique({ where: { id } });
  if (!request) throw new ChangeError("Request not found", 404);
  if (request.status !== "PENDING") throw new ChangeError("This request has already been decided.", 409);

  const decided = { decidedById: actor.id, decidedByName: actor.name, decidedAt: new Date(), decisionNote };
  const label = CHANGE_TYPES[request.type as ChangeType] ?? request.type;

  if (decision === "reject") {
    await prisma.changeRequest.update({ where: { id }, data: { ...decided, status: "REJECTED" } });
    await recordAudit(actor, {
      action: "request.reject",
      targetType: "request",
      targetId: id,
      targetLabel: request.targetLabel,
      note: `${label} (asked by ${request.requestedByName})${decisionNote ? ` · ${decisionNote}` : ""}`,
    });
    return { status: "REJECTED" };
  }

  try {
    await executeChange(
      request.type as ChangeType,
      request.clubId,
      request.payload,
      actor,
      `Approved request from ${request.requestedByName}${request.reason ? ` (reason: ${request.reason})` : ""}`,
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : "The change could not be applied";
    await prisma.changeRequest.update({ where: { id }, data: { ...decided, status: "FAILED", decisionNote: error } });
    await recordAudit(actor, {
      action: "request.approve",
      targetType: "request",
      targetId: id,
      targetLabel: request.targetLabel,
      note: `${label} approved but NOT applied: ${error}`,
    });
    return { status: "FAILED", error };
  }

  await prisma.changeRequest.update({ where: { id }, data: { ...decided, status: "APPROVED" } });
  await recordAudit(actor, {
    action: "request.approve",
    targetType: "request",
    targetId: id,
    targetLabel: request.targetLabel,
    note: `${label} (asked by ${request.requestedByName})${decisionNote ? ` · ${decisionNote}` : ""}`,
  });
  return { status: "APPROVED" };
}

/** How many requests are waiting, for the dashboard (0 if the table isn't there yet). */
export async function countPendingChanges(): Promise<number> {
  try {
    return await prisma.changeRequest.count({ where: { status: "PENDING" } });
  } catch (e) {
    if (isMissingTable(e)) return 0;
    throw e;
  }
}
