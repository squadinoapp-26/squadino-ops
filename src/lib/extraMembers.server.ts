import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";
import { recordAudit } from "@/lib/auditLog.server";
import { ChangeError } from "@/lib/changeError";
import { ClubAppError, decideExtraMembersInClubApp } from "@/lib/clubBillingApi.server";
import { extraMembersMonthlyPrice, type ExtraMembersDecision } from "@/lib/extraMembers";

export interface WaitingExtraMembers {
  id: string;
  clubId: string;
  clubName: string;
  members: number;
  requestedByName: string;
  requestedByEmail: string;
  createdAt: Date;
  // The club's member limit situation, so the person deciding can see it.
  approvedSoFar: number;
}

/** Requests waiting for a decision (the table may not exist until the database update is run). */
export async function listWaitingExtraMembers(): Promise<WaitingExtraMembers[]> {
  try {
    const rows = await prisma.extraMemberRequest.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      include: { club: { select: { name: true } } },
    });
    if (rows.length === 0) return [];
    const approved = await prisma.extraMemberRequest.groupBy({
      by: ["clubId"],
      where: { status: "APPROVED", clubId: { in: rows.map((r) => r.clubId) } },
      _sum: { members: true },
    });
    const approvedByClub = new Map(approved.map((a) => [a.clubId, a._sum.members ?? 0]));
    return rows.map((r) => ({
      id: r.id, clubId: r.clubId, clubName: r.club.name, members: r.members,
      requestedByName: r.requestedByName, requestedByEmail: r.requestedByEmail, createdAt: r.createdAt,
      approvedSoFar: approvedByClub.get(r.clubId) ?? 0,
    }));
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

/** Members a club has bought on top of its package (approved requests); 0 if none or the table isn't there yet. */
export async function approvedExtraMembersFor(clubId: string): Promise<number> {
  try {
    const sum = await prisma.extraMemberRequest.aggregate({ where: { clubId, status: "APPROVED" }, _sum: { members: true } });
    return sum._sum.members ?? 0;
  } catch (e) {
    if (isMissingTable(e)) return 0;
    throw e;
  }
}

/**
 * How many approved extra-member rows the club has ever had (packs added and removals), 0 if none or the table isn't there yet. The club
 * page keeps showing the extra-members box for a club that has had any, so its "removed" message isn't lost when the last extras go.
 */
export async function approvedExtraMemberRowsFor(clubId: string): Promise<number> {
  try {
    return await prisma.extraMemberRequest.count({ where: { clubId, status: "APPROVED" } });
  } catch (e) {
    if (isMissingTable(e)) return 0;
    throw e;
  }
}

/**
 * Approves or declines a club's request. The club app does the real work (adding the members to the club's
 * Stripe subscription, marking the request, emailing the club's admin); ops checks who is allowed, then
 * writes the Logs entry once the club app says it is done.
 */
export async function decideExtraMembers(
  requestId: string,
  decision: ExtraMembersDecision,
  note: string | null,
  actor: { id: string; name: string; role: string },
): Promise<void> {
  let req;
  try {
    req = await prisma.extraMemberRequest.findUnique({ where: { id: requestId }, include: { club: { select: { id: true, name: true } } } });
  } catch (e) {
    if (isMissingTable(e)) throw new ChangeError("The database update for extra members hasn't been run yet.", 503);
    throw e;
  }
  if (!req) throw new ChangeError("Request not found", 404);
  if (req.status !== "PENDING" && req.status !== "PROCESSING") throw new ChangeError("This request has already been decided.", 409);

  try {
    await decideExtraMembersInClubApp(req.clubId, req.id, decision, { name: actor.name, role: actor.role }, note);
  } catch (e) {
    if (e instanceof ClubAppError) throw new ChangeError(e.message, e.status >= 500 ? 502 : e.status);
    throw e;
  }

  const price = extraMembersMonthlyPrice(req.members);
  await recordAudit(actor, {
    action: decision === "approve" ? "billing.extra_members_approved" : "billing.extra_members_declined",
    targetType: "club",
    targetId: req.clubId,
    targetLabel: req.club.name,
    note: [
      `${req.members} extra members (${price} a month), asked for by ${req.requestedByName}`,
      note ? `Reason: ${note}` : null,
    ].filter(Boolean).join(" · "),
  });
}
