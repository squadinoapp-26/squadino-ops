import { describe, it, expect } from "vitest";
import { parseSignupEdit, packageChangeWarnings, type CurrentSignup } from "./signupEdit";

const CATALOG = ["Basketball", "Netball", "Swimming"];
const CURRENT: CurrentSignup = { packageKey: "growth", appVersion: "BASIC", orgType: "Club", sports: ["Basketball"] };

// What the edit form sends for the signup in the owner's screenshot.
const FORM = {
  packageKey: "growth",
  interval: "monthly",
  trialDays: "14",
  clubName: "Berwick Lakers Basket Ball Club",
  registeredName: "",
  orgType: "Club",
  sports: ["Basketball"],
  street: "12, Main Street",
  suburb: "Berwick",
  postcode: "3805",
  requestedUrl: "",
  estimatedUsers: "200",
  contactName: "Sampath Samarakoon",
  contactEmail: "Sampath.Samarakoon1982@gmail.com ",
  contactPhone: "",
};

function parse(overrides: Record<string, unknown> = {}, current = CURRENT) {
  return parseSignupEdit({ ...FORM, ...overrides }, current, CATALOG);
}

describe("parseSignupEdit", () => {
  it("accepts the form and tidies it for saving", () => {
    const result = parse();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      contactEmail: "sampath.samarakoon1982@gmail.com",
      registeredName: null,
      requestedUrl: null,
      contactPhone: null,
      estimatedUsers: 200,
      trialDays: 14,
      appVersion: "BASIC",
    });
  });

  it("sets the app version from the package, so a package change changes the club's modules", () => {
    const result = parse({ packageKey: "scale" });
    expect(result.ok && result.data.appVersion).toBe("PRO");
  });

  it("stores Free Trial as monthly, like the website does", () => {
    const result = parse({ packageKey: "free_trial", interval: "yearly" });
    expect(result.ok && result.data.interval).toBe("monthly");
    expect(result.ok && result.data.appVersion).toBe("FREE");
  });

  it("keeps a package the list no longer has, but won't switch to an unknown one", () => {
    const legacy = { ...CURRENT, packageKey: "legacy_plan", appVersion: "PRO" as const };
    const kept = parse({ packageKey: "legacy_plan" }, legacy);
    expect(kept.ok && kept.data.appVersion).toBe("PRO");
    expect(parse({ packageKey: "made_up" })).toEqual({ ok: false, error: "Pick a package from the list." });
  });

  it("refuses empty names and a broken email", () => {
    expect(parse({ clubName: "  " }).ok).toBe(false);
    expect(parse({ contactName: "" }).ok).toBe(false);
    expect(parse({ contactEmail: "sampath@gmail" }).ok).toBe(false);
  });

  it("only takes sports from the list (or already on the signup), without duplicates", () => {
    const result = parse({ sports: ["basketball", "Netball", "Basketball"] });
    expect(result.ok && result.data.sports).toEqual(["Basketball", "Netball"]);
    expect(parse({ sports: ["Quidditch"] }).ok).toBe(false);
    expect(parse({ sports: [] })).toEqual({ ok: false, error: "Pick at least one sport." });
    const old = parse({ sports: ["Lacrosse"] }, { ...CURRENT, sports: ["Lacrosse"] });
    expect(old.ok && old.data.sports).toEqual(["Lacrosse"]);
  });

  it("checks the numbers", () => {
    expect(parse({ estimatedUsers: "0" }).ok).toBe(false);
    expect(parse({ estimatedUsers: "12.5" }).ok).toBe(false);
    expect(parse({ trialDays: "-1" }).ok).toBe(false);
    expect(parse({ trialDays: "400" }).ok).toBe(false);
    expect(parse({ trialDays: "30" }).ok).toBe(true);
  });

  it("only accepts organisation types from the list, or the one already set", () => {
    expect(parse({ orgType: "Cult" }).ok).toBe(false);
    expect(parse({ orgType: "Social Club" }, { ...CURRENT, orgType: "Social Club" }).ok).toBe(true);
  });
});

describe("packageChangeWarnings", () => {
  const growth = { packageKey: "growth", interval: "monthly" };

  it("says nothing when the package doesn't change", () => {
    expect(packageChangeWarnings("stripe", growth, growth)).toEqual([]);
  });

  it("warns that Stripe keeps charging the old plan", () => {
    expect(packageChangeWarnings("stripe", growth, { packageKey: "scale", interval: "monthly" })).toHaveLength(1);
    expect(packageChangeWarnings("stripe", growth, { packageKey: "growth", interval: "yearly" })).toHaveLength(1);
  });

  it("warns when a free trial is moved to a paid package with no payment on file", () => {
    const freeTrial = { packageKey: "free_trial", interval: "monthly" };
    expect(packageChangeWarnings("none", freeTrial, growth)).toHaveLength(1);
  });

  it("has nothing to warn about for test-mode payments", () => {
    expect(packageChangeWarnings("dummy", growth, { packageKey: "scale", interval: "yearly" })).toEqual([]);
  });
});
