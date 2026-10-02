import { describe, it, expect } from "vitest";
import {
  billingActionFor, cleanReason, describeChange, isChangeType, parsePackageEdit, parsePlanChange, REASON_MAX,
} from "./changeRequests";

describe("isChangeType / billingActionFor", () => {
  it("knows the request types and which ones are billing actions", () => {
    expect(isChangeType("HOLD_START")).toBe(true);
    expect(isChangeType("DROP_TABLE")).toBe(false);
    expect(billingActionFor("HOLD_START")).toBe("start_hold");
    expect(billingActionFor("HOLD_RESUME")).toBe("resume");
    expect(billingActionFor("SUBSCRIPTION_CANCEL")).toBe("cancel");
    expect(billingActionFor("PLAN_CHANGE")).toBeNull();
    expect(billingActionFor("PACKAGE_EDIT")).toBeNull();
  });
});

describe("parsePlanChange", () => {
  it("accepts a package, a user limit, or both, and lets either be cleared", () => {
    expect(parsePlanChange({ packageId: "pkg1" })).toEqual({ ok: true, payload: { packageId: "pkg1" } });
    expect(parsePlanChange({ userCapOverride: 75 })).toEqual({ ok: true, payload: { userCapOverride: 75 } });
    expect(parsePlanChange({ packageId: null, userCapOverride: null })).toEqual({ ok: true, payload: { packageId: null, userCapOverride: null } });
    expect(parsePlanChange({ packageId: "" })).toEqual({ ok: true, payload: { packageId: null } });
  });

  it("refuses nothing to change or a bad limit", () => {
    expect(parsePlanChange({}).ok).toBe(false);
    expect(parsePlanChange({ reason: "x" }).ok).toBe(false);
    expect(parsePlanChange({ userCapOverride: 0 }).ok).toBe(false);
    expect(parsePlanChange({ userCapOverride: 1.5 }).ok).toBe(false);
    expect(parsePlanChange({ userCapOverride: "10" }).ok).toBe(false);
    expect(parsePlanChange({ packageId: 5 }).ok).toBe(false);
  });
});

describe("parsePackageEdit", () => {
  const good = { name: " Growth ", userCap: 400, priceCents: 11900, trialDays: 14, active: true };

  it("tidies a valid edit", () => {
    expect(parsePackageEdit("p1", good)).toEqual({
      ok: true,
      payload: { packageId: "p1", name: "Growth", userCap: 400, priceCents: 11900, trialDays: 14, active: true },
    });
    expect(parsePackageEdit("p1", { ...good, userCap: null, trialDays: null }).ok).toBe(true);
  });

  it("refuses a missing name, bad limit, negative price or bad trial", () => {
    expect(parsePackageEdit("p1", { ...good, name: " " }).ok).toBe(false);
    expect(parsePackageEdit("p1", { ...good, userCap: 0 }).ok).toBe(false);
    expect(parsePackageEdit("p1", { ...good, priceCents: -1 }).ok).toBe(false);
    expect(parsePackageEdit("p1", { ...good, trialDays: -3 }).ok).toBe(false);
  });
});

describe("cleanReason", () => {
  it("trims, caps the length and returns null for nothing", () => {
    expect(cleanReason("  needs a break ")).toBe("needs a break");
    expect(cleanReason("   ")).toBeNull();
    expect(cleanReason(42)).toBeNull();
    expect(cleanReason("x".repeat(REASON_MAX + 50))).toHaveLength(REASON_MAX);
  });
});

describe("describeChange", () => {
  it("says what a request would do", () => {
    expect(describeChange("PLAN_CHANGE", { packageId: "p1", userCapOverride: 80 }, { p1: "Growth" })).toBe("package: Growth; user limit: 80");
    expect(describeChange("PLAN_CHANGE", { userCapOverride: null })).toBe("remove the user-limit override");
    expect(describeChange("PACKAGE_EDIT", { name: "Growth", priceCents: 11900, userCap: 400, active: true })).toBe("Growth: $119.00/mo, 400 users");
    expect(describeChange("HOLD_START", {})).toContain("$50/month");
    expect(describeChange("SUBSCRIPTION_CANCEL", {})).toContain("end of the period");
  });
});
