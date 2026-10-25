// A club's request for extra members, as staff decide it. Pure and client-safe; the database side is in
// extraMembers.server.ts. Keep the price in step with the club app's src/lib/memberLimit.ts.

import { cleanReason } from "@/lib/cleanReason";

export const EXTRA_MEMBER_PRICE_CENTS = 50;

/** "$12.50", "$25", "$50": a pack's price per month; whole dollars drop the cents. */
export function extraMembersMonthlyPrice(members: number): string {
  const cents = members * EXTRA_MEMBER_PRICE_CENTS;
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export type ExtraMembersDecision = "approve" | "decline";

type Parsed = { ok: true; decision: ExtraMembersDecision; note: string | null } | { ok: false; error: string };

/**
 * What staff sent when deciding a request. A decline always needs a reason (the club's admin is shown it);
 * an admin or super admin always gives one when approving too (the owner's rule for every admin decision),
 * while a moderator's note on an approval is optional.
 */
export function parseExtraMembersDecision(role: string, body: unknown): Parsed {
  const b = (body ?? {}) as { decision?: unknown; note?: unknown };
  if (b.decision !== "approve" && b.decision !== "decline") return { ok: false, error: "Choose approve or decline." };
  const note = cleanReason(b.note);
  if (b.decision === "decline" && !note) return { ok: false, error: "Give a reason for declining; the club's admin will see it." };
  if (b.decision === "approve" && !note && (role === "ADMIN" || role === "SUPER_ADMIN")) {
    return { ok: false, error: "Give a reason for approving this request." };
  }
  return { ok: true, decision: b.decision, note };
}

// ── Taking extra members off a club ───────────────────────────────────────────────────────────────────────────────────────────

/** What the removal form shows before anyone presses the button: the Stripe charge, the club's limit and whether it would be over it. */
export function removalPreview(args: { members: number; extrasNow: number; limitNow: number | null; memberCount: number }) {
  const { members, extrasNow, limitNow, memberCount } = args;
  const limitAfter = limitNow == null ? null : limitNow - members;
  return {
    extrasAfter: extrasNow - members,
    chargeDrop: extraMembersMonthlyPrice(members),
    chargeAfter: extraMembersMonthlyPrice(extrasNow - members),
    limitAfter,
    overBy: limitAfter == null ? 0 : Math.max(0, memberCount - limitAfter),
  };
}

/** What the club app reports back after taking extra members off (see removeExtraMembers in its billingActions.server.ts). */
export interface ExtraMembersRemovalResult {
  removed: number;
  extrasNow: number;
  stripe: "set" | "removed" | "none";
  limit: number | null;
  members: number;
  overBy: number;
  emailed: number;
  resumed: boolean;
}

/** The Logs line for a removal: what was done in Stripe, the club's new limit, who was emailed, and whether the club is over its new limit. */
export function describeRemovalResult(r: ExtraMembersRemovalResult, emailRequested: boolean): string {
  const stripe = r.stripe === "removed" ? "the extra-members line was taken off the subscription in Stripe"
    : r.stripe === "set" ? "the extra-members line in Stripe was lowered"
    : "nothing needed changing in Stripe (no live subscription or no extra-members line, or it was already lower)";
  const email = !emailRequested ? "nobody was emailed" : r.emailed > 0 ? `${r.emailed} admin${r.emailed === 1 ? "" : "s"} emailed` : "the club's admins were NOT emailed (none could be reached, see the Logs for email problems)";
  return [
    `Removed ${r.removed} extra member${r.removed === 1 ? "" : "s"}; the club now has ${r.extrasNow}`,
    stripe,
    r.limit != null ? `member limit now ${r.limit}` : null,
    r.overBy > 0 ? `the club has ${r.members} members, ${r.overBy} over the new limit (nobody was removed)` : null,
    email,
    r.resumed ? "this finished an earlier removal that had stopped half way" : null,
  ].filter(Boolean).join(" · ");
}

