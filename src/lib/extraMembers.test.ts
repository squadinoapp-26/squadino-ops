import { describe, expect, it } from "vitest";
import { extraMembersMonthlyPrice, parseExtraMembersDecision } from "./extraMembers";
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
