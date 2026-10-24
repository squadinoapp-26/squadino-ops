import { describe, expect, it } from "vitest";
import { describeRemovalResult, extraMembersMonthlyPrice, parseExtraMembersDecision, removalPreview } from "./extraMembers";
import { canDecideExtraMembers } from "./auth";

describe("extraMembersMonthlyPrice", () => {
  it("is 50 cents a member", () => {
    expect(extraMembersMonthlyPrice(25)).toBe("$12.50");
    expect(extraMembersMonthlyPrice(50)).toBe("$25");
    expect(extraMembersMonthlyPrice(100)).toBe("$50");
  });
});

describe("canDecideExtraMembers", () => {
  it("lets super admins, admins and moderators decide, and customer care only look", () => {
    expect(canDecideExtraMembers("SUPER_ADMIN")).toBe(true);
    expect(canDecideExtraMembers("ADMIN")).toBe(true);
    expect(canDecideExtraMembers("MODERATOR")).toBe(true);
    expect(canDecideExtraMembers("CUSTOMER_CARE")).toBe(false);
    expect(canDecideExtraMembers(undefined)).toBe(false);
  });
});

describe("parseExtraMembersDecision", () => {
  it("needs approve or decline", () => {
    expect(parseExtraMembersDecision("ADMIN", { decision: "maybe", note: "x" }).ok).toBe(false);
    expect(parseExtraMembersDecision("ADMIN", {}).ok).toBe(false);
    expect(parseExtraMembersDecision("ADMIN", null).ok).toBe(false);
  });

  it("always needs a reason to decline, whoever declines", () => {
    expect(parseExtraMembersDecision("MODERATOR", { decision: "decline" }).ok).toBe(false);
    expect(parseExtraMembersDecision("ADMIN", { decision: "decline", note: "   " }).ok).toBe(false);
    expect(parseExtraMembersDecision("MODERATOR", { decision: "decline", note: "Payment overdue" })).toEqual({ ok: true, decision: "decline", note: "Payment overdue" });
  });

  it("makes an admin give a reason to approve, but not a moderator", () => {
    expect(parseExtraMembersDecision("ADMIN", { decision: "approve" }).ok).toBe(false);
    expect(parseExtraMembersDecision("SUPER_ADMIN", { decision: "approve", note: "" }).ok).toBe(false);
    expect(parseExtraMembersDecision("ADMIN", { decision: "approve", note: "Paid up" })).toEqual({ ok: true, decision: "approve", note: "Paid up" });
    expect(parseExtraMembersDecision("MODERATOR", { decision: "approve" })).toEqual({ ok: true, decision: "approve", note: null });
  });

  it("trims the reason", () => {
    expect(parseExtraMembersDecision("MODERATOR", { decision: "approve", note: "  fine  " })).toEqual({ ok: true, decision: "approve", note: "fine" });
  });
});

describe("taking extra members off a club", () => {
  it("previews the charge, the limit and whether the club ends up over it", () => {
    expect(removalPreview({ members: 25, extrasNow: 50, limitNow: 126, memberCount: 40 })).toEqual({
      extrasAfter: 25, chargeDrop: "$12.50", chargeAfter: "$12.50", limitAfter: 101, overBy: 0,
    });
    const over = removalPreview({ members: 50, extrasNow: 50, limitNow: 101, memberCount: 90 });
    expect(over).toMatchObject({ extrasAfter: 0, chargeDrop: "$25", chargeAfter: "$0", limitAfter: 51, overBy: 39 });
  });

  it("has no limit to lower when the club has none", () => {
    expect(removalPreview({ members: 5, extrasNow: 5, limitNow: null, memberCount: 999 })).toMatchObject({ limitAfter: null, overBy: 0 });
  });

  it("writes the Logs line: Stripe, limit, who was emailed, and the club being over its limit", () => {
    const base = { removed: 25, extrasNow: 25, stripe: "set" as const, limit: 76, members: 40, overBy: 0, emailed: 2, resumed: false };
    expect(describeRemovalResult(base, true)).toBe(
      "Removed 25 extra members; the club now has 25 · the extra-members line in Stripe was lowered · member limit now 76 · 2 admins emailed",
    );
    expect(describeRemovalResult({ ...base, stripe: "removed", extrasNow: 0, overBy: 9, members: 60, limit: 51, emailed: 0 }, false)).toBe(
      "Removed 25 extra members; the club now has 0 · the extra-members line was taken off the subscription in Stripe · member limit now 51 · the club has 60 members, 9 over the new limit (nobody was removed) · nobody was emailed",
    );
  });

  it("says when nothing needed changing in Stripe, when emails could not go, and when it finished an earlier removal", () => {
    const text = describeRemovalResult({ removed: 1, extrasNow: 9, stripe: "none", limit: null, members: 3, overBy: 0, emailed: 0, resumed: true }, true);
    expect(text).toContain("Removed 1 extra member; the club now has 9");
    expect(text).toContain("nothing needed changing in Stripe");
    expect(text).toContain("the club's admins were NOT emailed");
    expect(text).toContain("this finished an earlier removal that had stopped half way");
    expect(text).not.toContain("member limit now");
  });
});
