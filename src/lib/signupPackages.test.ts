import { describe, it, expect } from "vitest";
import { SIGNUP_PACKAGES, signupPackageLabel } from "./signupPackages";

// This list mirrors Website/src/lib/packages.ts in the squadino repo, which is the source of
// truth for what customers can buy. This repo can't read that file, so the expected values are
// written out here: if a plan's app version or paid/trial setting changes on the website,
// change it in signupPackages.ts and here together.
describe("SIGNUP_PACKAGES", () => {
  it("maps each package to the plan the club gets", () => {
    expect(SIGNUP_PACKAGES.map((p) => [p.key, p.appVersion, p.paid, p.fixedInterval])).toEqual([
      ["free_trial", "FREE", false, true],
      ["starter", "BASIC", true, false],
      ["growth", "BASIC", true, false],
      ["scale", "PRO", true, false],
      ["full", "PRO", true, false],
      ["coach", "COACH", true, false],
    ]);
  });
});

describe("signupPackageLabel", () => {
  it("names the package and billing", () => {
    expect(signupPackageLabel("growth", "monthly")).toBe("Growth · monthly");
    expect(signupPackageLabel("free_trial", "monthly")).toBe("Free Trial");
    expect(signupPackageLabel("legacy", "yearly")).toBe("legacy · yearly");
  });
});
