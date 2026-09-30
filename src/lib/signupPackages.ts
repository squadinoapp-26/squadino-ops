// The packages a signup can be on, for the platform's signup editor. The
// marketing site (Website/src/lib/packages.ts) is the source of truth for
// what customers can buy; this mirrors just the fields the club app needs to
// create the club right. signupPackages.test.ts fails if the two drift.

export type SignupAppVersion = "FREE" | "BASIC" | "PRO" | "COACH";

export interface SignupPackage {
  key: string;
  name: string;
  appVersion: SignupAppVersion;
  trialDays: number;
  // False for the $0 Free Trial — no payment is taken at checkout.
  paid: boolean;
  // Free Trial has no monthly/yearly choice.
  fixedInterval: boolean;
}

export const SIGNUP_PACKAGES: SignupPackage[] = [
  { key: "free_trial", name: "Free Trial", appVersion: "FREE", trialDays: 14, paid: false, fixedInterval: true },
  { key: "starter", name: "Starter", appVersion: "BASIC", trialDays: 14, paid: true, fixedInterval: false },
  { key: "growth", name: "Growth", appVersion: "BASIC", trialDays: 14, paid: true, fixedInterval: false },
  { key: "scale", name: "Scale", appVersion: "PRO", trialDays: 14, paid: true, fixedInterval: false },
  { key: "full", name: "Full", appVersion: "PRO", trialDays: 14, paid: true, fixedInterval: false },
  { key: "coach", name: "Coach", appVersion: "COACH", trialDays: 14, paid: true, fixedInterval: false },
];

export const SIGNUP_INTERVALS = ["monthly", "yearly"] as const;

export function getSignupPackage(key: string): SignupPackage | undefined {
  return SIGNUP_PACKAGES.find((p) => p.key === key);
}

/** "Growth · monthly", falling back to the raw key for a package this list doesn't know. */
export function signupPackageLabel(key: string, interval: string): string {
  const pkg = getSignupPackage(key);
  if (!pkg) return `${key} · ${interval}`;
  return pkg.fixedInterval ? pkg.name : `${pkg.name} · ${interval}`;
}
