import { describe, it, expect } from "vitest";
import {
  billingActionFor, cleanReason, describeChange, isChangeType, parseExtension, parsePackageEdit, parsePlanChange, parseSignupPreApprove, parseSignupReject,
  parseSignupEditRequest, signupEditChanges, decisionNoteRequired, requestStatusLabel, REASON_MAX,
} from "./changeRequests";
import type { SignupEditData } from "./signupEdit";

describe("isChangeType / billingActionFor", () => {
  it("knows the request types and which ones are billing actions", () => {
    expect(isChangeType("HOLD_START")).toBe(true);
    expect(isChangeType("DROP_TABLE")).toBe(false);
    expect(billingActionFor("HOLD_START")).toBe("offer_hold");
    expect(billingActionFor("HOLD_EXTEND")).toBe("offer_extension");
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
    expect(describeChange("HOLD_START", {})).toContain("offer");
    expect(describeChange("SUBSCRIPTION_CANCEL", {})).toContain("end of the period");
  });
});

describe("parseExtension", () => {
  it("accepts only 1 or 2 months", () => {
    expect(parseExtension({ months: 1 })).toEqual({ ok: true, payload: { months: 1 } });
    expect(parseExtension({ months: 2 })).toEqual({ ok: true, payload: { months: 2 } });
    expect(parseExtension({ months: 3 }).ok).toBe(false);
    expect(parseExtension({ months: "2" }).ok).toBe(false);
    expect(parseExtension({}).ok).toBe(false);
    expect(parseExtension(null).ok).toBe(false);
  });

  it("describes the request", () => {
    expect(describeChange("HOLD_EXTEND", { months: 2 })).toContain("2 more months");
    expect(describeChange("HOLD_EXTEND", { months: 1 })).toContain("1 more month ");
  });
});

describe("rejecting a signup (SIGNUP_REJECT)", () => {
  it("is a request type that is not a billing action", () => {
    expect(isChangeType("SIGNUP_REJECT")).toBe(true);
    expect(billingActionFor("SIGNUP_REJECT")).toBeNull();
    expect(describeChange("SIGNUP_REJECT", { signupId: "s1", reason: "x" })).toContain("re-instate");
  });

  it("needs a written reason, tidied and capped", () => {
    expect(parseSignupReject("s1", "  Looks like a duplicate  ")).toEqual({ ok: true, payload: { signupId: "s1", reason: "Looks like a duplicate" } });
    expect(parseSignupReject("s1", "").ok).toBe(false);
    expect(parseSignupReject("s1", "   ").ok).toBe(false);
    expect(parseSignupReject("s1", undefined).ok).toBe(false);
    expect(parseSignupReject("s1", 42).ok).toBe(false);
    const long = parseSignupReject("s1", "x".repeat(REASON_MAX + 50));
    expect(long.ok && long.payload.reason).toHaveLength(REASON_MAX);
  });

  it("words the outcome as re-instated when an admin turns the request down", () => {
    expect(requestStatusLabel("SIGNUP_REJECT", "PENDING")).toBe("Waiting for approval");
    expect(requestStatusLabel("SIGNUP_REJECT", "APPROVED")).toBe("Rejection approved");
    expect(requestStatusLabel("SIGNUP_REJECT", "REJECTED")).toBe("Signup re-instated");
    expect(requestStatusLabel("PLAN_CHANGE", "REJECTED")).toBe("Rejected");
    expect(requestStatusLabel("PLAN_CHANGE", "APPROVED")).toBe("Approved");
  });
});

describe("pre-approving a signup (SIGNUP_PREAPPROVE)", () => {
  it("is a request type that is not a billing action", () => {
    expect(isChangeType("SIGNUP_PREAPPROVE")).toBe(true);
    expect(billingActionFor("SIGNUP_PREAPPROVE")).toBeNull();
    expect(describeChange("SIGNUP_PREAPPROVE", { signupId: "s1", slug: "walkerscc" })).toContain("walkerscc.squadino.com");
    expect(describeChange("SIGNUP_PREAPPROVE", { signupId: "s1" })).toContain("send it back");
  });

  it("makes the pre-approver confirm the payment on a paid plan, and notes are optional", () => {
    expect(parseSignupPreApprove("s1", { slug: " walkerscc ", paymentChecked: true, notes: " Checked in Stripe " }, { needsPaymentCheck: true })).toEqual({
      ok: true,
      payload: { signupId: "s1", slug: "walkerscc", paymentChecked: true, notes: "Checked in Stripe" },
    });
    expect(parseSignupPreApprove("s1", { paymentChecked: false }, { needsPaymentCheck: true }).ok).toBe(false);
    expect(parseSignupPreApprove("s1", {}, { needsPaymentCheck: true }).ok).toBe(false);
    expect(parseSignupPreApprove("s1", {}, { needsPaymentCheck: false })).toEqual({
      ok: true,
      payload: { signupId: "s1", paymentChecked: false, notes: null },
    });
  });

  it("caps the notes", () => {
    const r = parseSignupPreApprove("s1", { notes: "x".repeat(REASON_MAX + 20) }, { needsPaymentCheck: false });
    expect(r.ok && r.payload.notes).toHaveLength(REASON_MAX);
  });

  it("words the outcome as club created / sent back", () => {
    expect(requestStatusLabel("SIGNUP_PREAPPROVE", "APPROVED")).toBe("Approved: club created");
    expect(requestStatusLabel("SIGNUP_PREAPPROVE", "REJECTED")).toBe("Sent back for review");
  });
});

describe("correcting a signup's details (SIGNUP_EDIT)", () => {
  // A signup as it is in the database: the customer typed their email wrong.
  const CURRENT: SignupEditData = {
    packageKey: "growth", interval: "monthly", trialDays: 14, appVersion: "BASIC",
    clubName: "Berwick Lakers", registeredName: null, orgType: "Club", sports: ["Basketball"],
    street: "12 Main Street", suburb: "Berwick", postcode: "3805", requestedUrl: null,
    estimatedUsers: 200, contactName: "Sam Smith", contactEmail: "sam@exmaple.com", contactPhone: null,
  };
  const CATALOG = ["Basketball", "Netball"];
  // What the edit form sends: every field as a string, plus the reason.
  const form = (over: Record<string, unknown> = {}) => ({
    packageKey: "growth", interval: "monthly", trialDays: "14", clubName: "Berwick Lakers", registeredName: "", orgType: "Club",
    sports: ["Basketball"], street: "12 Main Street", suburb: "Berwick", postcode: "3805", requestedUrl: "", estimatedUsers: "200",
    contactName: "Sam Smith", contactEmail: "sam@example.com", contactPhone: "", reason: "Customer typed the email wrong", ...over,
  });

  it("is a request type that is not a billing action, and an admin always gives a reason when deciding it", () => {
    expect(isChangeType("SIGNUP_EDIT")).toBe(true);
    expect(billingActionFor("SIGNUP_EDIT")).toBeNull();
    expect(decisionNoteRequired("SIGNUP_EDIT")).toBe(true);
  });

  it("keeps the new details, the details as they were, and the reason", () => {
    const r = parseSignupEditRequest("s1", form(), CURRENT, CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reason).toBe("Customer typed the email wrong");
    expect(r.payload.signupId).toBe("s1");
    expect(r.payload.before).toEqual(CURRENT);
    expect(r.payload.data.contactEmail).toBe("sam@example.com");
    expect(r.payload.data.clubName).toBe("Berwick Lakers");
    expect(r.changes.map((c) => [c.field, c.from, c.to])).toEqual([["contactEmail", "sam@exmaple.com", "sam@example.com"]]);
  });

  it("copies the old details, so a later change to the signup can't alter the proposal's 'before'", () => {
    const current = { ...CURRENT, sports: ["Basketball"] };
    const r = parseSignupEditRequest("s1", form(), current, CATALOG);
    if (!r.ok) throw new Error("expected ok");
    current.sports.push("Netball");
    expect(r.payload.before.sports).toEqual(["Basketball"]);
  });

  it("needs a written reason whenever something changes, and caps it", () => {
    expect(parseSignupEditRequest("s1", form({ reason: "" }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ reason: "   " }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ reason: undefined }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ reason: 42 }), CURRENT, CATALOG).ok).toBe(false);
    const long = parseSignupEditRequest("s1", form({ reason: "x".repeat(REASON_MAX + 50) }), CURRENT, CATALOG);
    expect(long.ok && long.reason).toHaveLength(REASON_MAX);
  });

  it("says nothing changed (no reason needed) when the form matches the signup", () => {
    const r = parseSignupEditRequest("s1", form({ contactEmail: "sam@exmaple.com", reason: "" }), CURRENT, CATALOG);
    expect(r.ok && r.changes).toEqual([]);
  });

  it("applies the same field rules as the old edit form", () => {
    expect(parseSignupEditRequest("s1", form({ contactEmail: "not an email" }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ clubName: " " }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ sports: [] }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", form({ sports: ["Quidditch"] }), CURRENT, CATALOG).ok).toBe(false);
    expect(parseSignupEditRequest("s1", null, CURRENT, CATALOG).ok).toBe(false);
  });

  it("follows the package: a different package changes the app version too", () => {
    const r = parseSignupEditRequest("s1", form({ packageKey: "scale", contactEmail: "sam@exmaple.com" }), CURRENT, CATALOG);
    expect(r.ok && r.payload.data.appVersion).toBe("PRO");
    expect(r.ok && r.changes.map((c) => c.field)).toEqual(["packageKey", "appVersion"]);
  });

  it("lists what a stored request would change, and copes with a payload of the wrong shape", () => {
    const r = parseSignupEditRequest("s1", form({ suburb: "Narre Warren" }), CURRENT, CATALOG);
    if (!r.ok) throw new Error("expected ok");
    expect(signupEditChanges(r.payload).map((c) => c.field)).toEqual(["suburb", "contactEmail"]);
    expect(signupEditChanges(null)).toEqual([]);
    expect(signupEditChanges({ signupId: "s1" })).toEqual([]);
    expect(signupEditChanges({ data: "x", before: "y" })).toEqual([]);
  });

  it("describes the request for the Approvals list with old and new values", () => {
    const r = parseSignupEditRequest("s1", form(), CURRENT, CATALOG);
    if (!r.ok) throw new Error("expected ok");
    const text = describeChange("SIGNUP_EDIT", r.payload);
    expect(text).toContain("Contact email: sam@exmaple.com → sam@example.com");
    expect(text).toContain("decline it and nothing changes");
    expect(describeChange("SIGNUP_EDIT", {})).toContain("Correct this new signup's details");
  });

  it("words the outcome as corrected / declined", () => {
    expect(requestStatusLabel("SIGNUP_EDIT", "PENDING")).toBe("Waiting for approval");
    expect(requestStatusLabel("SIGNUP_EDIT", "APPROVED")).toBe("Approved: details corrected");
    expect(requestStatusLabel("SIGNUP_EDIT", "REJECTED")).toBe("Declined: details unchanged");
  });
});

describe("decisionNoteRequired", () => {
  it("makes an admin give a reason on every kind of signup request, and on no other change", () => {
    expect(decisionNoteRequired("SIGNUP_REJECT")).toBe(true);
    expect(decisionNoteRequired("SIGNUP_PREAPPROVE")).toBe(true);
    expect(decisionNoteRequired("SIGNUP_EDIT")).toBe(true);
    expect(decisionNoteRequired("PLAN_CHANGE")).toBe(false);
    expect(decisionNoteRequired("HOLD_START")).toBe(false);
  });
});
