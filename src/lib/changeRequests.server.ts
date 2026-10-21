import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { canApproveChanges } from "@/lib/auth";
import { diffFields } from "@/lib/auditLog";
import { recordAudit } from "@/lib/auditLog.server";
import { isMissingTable } from "@/lib/prismaErrors";
import { applyFreeDaysInClubApp, runClubBillingAction } from "@/lib/clubBillingApi.server";
import { daysWord, describeFreeDates, parseFreeDaysRequest } from "@/lib/freeDays";
import { sendEmail } from "@/lib/email";
import { signupRejectedEmail } from "@/lib/signupRejectedEmail";
import {
  CHANGE_TYPES, billingActionFor, decisionNoteRequired, type ChangeType, type PackageEditPayload, type PlanChangePayload,
  type SignupEditPayload, type SignupPreApprovePayload, type SignupRejectPayload,
} from "@/lib/changeRequests";
import { ChangeError } from "@/lib/changeError";
import { approveSignup } from "@/lib/signupApproval.server";
import { parseSignupEdit, signupEditSnapshot, SIGNUP_EDIT_FIELDS } from "@/lib/signupEdit";
import { listSportNames } from "@/lib/sportCatalog.server";

export { ChangeError };

type Actor = { id: string; name: string; role: string };

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
  // What makes a request happen once: an approved request's id, or a direct submission's own key (free days only).
  key?: string,
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

    case "SIGNUP_REJECT": {
      const p = payload as SignupRejectPayload;
      const signup = await prisma.signupRequest.findUnique({ where: { id: p.signupId }, select: { id: true, clubName: true, contactName: true, contactEmail: true } });
      if (!signup) throw new ChangeError("Signup not found", 404);
      // Only a signup nobody has reviewed yet can be rejected; the status in the filter stops two people
      // (or a request and an approval) from deciding the same signup at once.
      const done = await prisma.signupRequest.updateMany({
        where: { id: signup.id, status: "PENDING" },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedByPlatformUserId: actor.id, rejectionReason: p.reason },
      });
      if (done.count === 0) throw new ChangeError("This signup has already been reviewed.", 409);

      // The customer is told, once, now that the rejection is final (never when a moderator only asks for it). Only an explicit `true` sends,
      // so a request made before this existed emails nobody. A failure to send never undoes the rejection; it is written in the Logs.
      let customerNote = "Customer not emailed";
      if (p.emailCustomer === true) {
        if (!signup.contactEmail.includes("@")) {
          customerNote = "Customer NOT emailed: the signup has no usable email address";
        } else {
          const sent = await sendEmail({ ...signupRejectedEmail({ clubName: signup.clubName, contactName: signup.contactName, message: p.customerMessage }), to: signup.contactEmail });
          customerNote = sent.error
            ? `Customer email could NOT be sent (${sent.error})`
            : !sent.delivered
              ? "Customer email was not sent (no mail provider is set up)"
              : `Customer emailed${p.customerMessage ? ` with this message: ${p.customerMessage.slice(0, 300)}` : " (standard message)"}`;
        }
      }
      await recordAudit(actor, {
        action: "signup.reject",
        targetType: "signup",
        targetId: signup.id,
        targetLabel: signup.clubName,
        note: `${withNote(null) ?? `Reason: ${p.reason}`} · ${customerNote}`,
      });
      return;
    }

    case "SIGNUP_PREAPPROVE": {
      // The admin's approval of a pre-approved signup: the club is created now, in the admin's name.
      const p = payload as SignupPreApprovePayload;
      await approveSignup({ signupId: p.signupId, slug: p.slug, paymentChecked: p.paymentChecked === true, actor, note: note ?? null });
      return;
    }

    case "SIGNUP_EDIT": {
      // The corrected details are saved now, in the actor's name (an admin's own correction, or an admin approving a request).
      const p = payload as SignupEditPayload;
      const signup = await prisma.signupRequest.findUnique({ where: { id: p.signupId } });
      if (!signup) throw new ChangeError("Signup not found", 404);
      if (signup.status !== "PENDING") throw new ChangeError("This signup has already been reviewed, so its details can't be changed any more.", 409);

      const current = signupEditSnapshot(signup);
      // If the details moved on since the correction was asked for, the old -> new list the approver read is no longer what would happen.
      if (diffFields(p.before, current, SIGNUP_EDIT_FIELDS).length > 0) {
        throw new ChangeError("This signup's details changed after the correction was asked for. Ask for the correction again.", 409);
      }
      // Checked again with the same rules, in case what was stored is not what the form would send today.
      const checked = parseSignupEdit(p.data, current, await listSportNames());
      if (!checked.ok) throw new ChangeError(checked.error);
      const changes = diffFields(current, checked.data, SIGNUP_EDIT_FIELDS);
      if (changes.length === 0) throw new ChangeError("These details are already on the signup, so there is nothing to change.", 409);

      // The status in the filter stops this from landing on a signup someone has just approved or rejected.
      const done = await prisma.signupRequest.updateMany({ where: { id: signup.id, status: "PENDING" }, data: checked.data });
      if (done.count === 0) throw new ChangeError("This signup has already been reviewed, so its details can't be changed any more.", 409);
      await recordAudit(actor, {
        action: "signup.edit",
        targetType: "signup",
        targetId: signup.id,
        targetLabel: checked.data.clubName,
        changes,
        note: withNote(null),
      });
      return;
    }

    case "FREE_DAYS": {
      // Free service days: checked again here with the same rules, then the club app gives each club its days and emails its admins.
      const checked = parseFreeDaysRequest(payload, new Date());
      if (!checked.ok) throw new ChangeError(checked.error);
      const request = checked.value;
      let summary;
      try {
        summary = await applyFreeDaysInClubApp(key ?? `direct:${actor.id}:${Date.now()}`, request, actor, note ?? null);
      } catch (e) {
        throw new ChangeError(e instanceof Error ? e.message : "The club app couldn't give the free days", 502);
      }
      await recordAudit(actor, {
        action: "free_days.sent",
        targetType: "free_days",
        targetId: summary.grantId,
        targetLabel: request.title,
        note: withNote(
          `${daysWord(request.dates.length)} free (${describeFreeDates(request.dates)}) for ${summary.total} club${summary.total === 1 ? "" : "s"}: ${summary.applied} done, ${summary.failed} not done, ${summary.emailed} emailed${summary.emailProblems ? `, ${summary.emailProblems} with an email still to send` : ""}`,
        ),
      });
      // Nothing worked at all (every club failed): the request is reported as approved but not applied, with the reason.
      if (summary.total > 0 && summary.applied === 0 && summary.pending === 0) {
        throw new ChangeError(`No club could be given the free days. ${summary.failures[0]?.clubName ? `${summary.failures[0].clubName}: ` : ""}${summary.failures[0]?.error ?? ""}`.trim(), 502);
      }
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
  input: { type: ChangeType; clubId: string | null; payload: unknown; reason: string | null; targetLabel?: string; key?: string },
  actor: Actor,
): Promise<SubmitResult> {
  if (canApproveChanges(actor.role)) {
    await executeChange(input.type, input.clubId, input.payload, actor, input.reason ? `Reason: ${input.reason}` : undefined, input.key);
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

/**
 * An admin approves (the change is made now) or rejects a pending request. Deciding on a new signup always
 * needs a written reason, whichever way it goes. `extra.slug` lets the admin change the web address of a
 * pre-approved club as they approve it.
 */
export async function decideChange(
  id: string,
  decision: "approve" | "reject",
  decisionNote: string | null,
  actor: Actor,
  extra?: { slug?: string },
): Promise<{ status: "APPROVED" | "REJECTED" | "FAILED"; error?: string }> {
  if (!canApproveChanges(actor.role)) throw new ChangeError("Only super admins and admins can approve or reject changes.", 403);

  const request = await prisma.changeRequest.findUnique({ where: { id } });
  if (!request) throw new ChangeError("Request not found", 404);
  if (request.status !== "PENDING") throw new ChangeError("This request has already been decided.", 409);
  if (decisionNoteRequired(request.type) && !decisionNote) throw new ChangeError("Give a reason for your decision.", 400);

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
    // Turning a signup request down puts the signup back in the queue (or, for a correction, leaves it as it was); say so on the
    // signup's own history too.
    const signupId = decisionNoteRequired(request.type) ? (request.payload as { signupId?: unknown } | null)?.signupId : null;
    if (typeof signupId === "string") {
      const kind = request.type === "SIGNUP_PREAPPROVE" ? "Pre-approval" : request.type === "SIGNUP_EDIT" ? "Correction to the details" : "Rejection";
      const action = request.type === "SIGNUP_PREAPPROVE" ? "signup.preapprove_declined" : request.type === "SIGNUP_EDIT" ? "signup.edit_declined" : "signup.reinstate";
      await recordAudit(actor, {
        action,
        targetType: "signup",
        targetId: signupId,
        targetLabel: request.targetLabel,
        note: `${kind} asked for by ${request.requestedByName}${request.reason ? ` (${request.type === "SIGNUP_PREAPPROVE" ? "notes" : "reason"}: ${request.reason})` : ""} was not approved · Admin's reason: ${decisionNote}`,
      });
    }
    return { status: "REJECTED" };
  }

  const payload =
    request.type === "SIGNUP_PREAPPROVE" && extra?.slug ? { ...(request.payload as object), slug: extra.slug } : request.payload;
  try {
    await executeChange(
      request.type as ChangeType,
      request.clubId,
      payload,
      actor,
      `Approved request from ${request.requestedByName}${request.reason ? ` (${request.type === "SIGNUP_PREAPPROVE" ? "notes" : "reason"}: ${request.reason})` : ""}${decisionNote ? ` · Admin's reason: ${decisionNote}` : ""}`,
      `req:${request.id}`,
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : "The change could not be applied";
    await prisma.changeRequest.update({ where: { id }, data: { ...decided, status: "FAILED", decisionNote: error } });
    await recordAudit(actor, {
      action: "request.approve",
      targetType: "request",
      targetId: id,
      targetLabel: request.targetLabel,
      note: `${label} approved but NOT applied: ${error}${decisionNote ? ` · Admin's reason: ${decisionNote}` : ""}`,
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
