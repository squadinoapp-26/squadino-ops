// A club's request for extra members, as staff decide it. Pure and client-safe; the database side is in
// extraMembers.server.ts. Keep the price in step with the club app's src/lib/memberLimit.ts.

import { cleanReason } from "@/lib/changeRequests";

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
