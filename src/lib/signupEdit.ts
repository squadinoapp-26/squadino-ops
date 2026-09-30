// Correcting a pending signup's details from /signups/[id] before
// it's approved: validation, the fields the change log compares, and the
// payment warnings shown when the package changes. Pure, so it's unit-tested
// and shared by the edit form and PATCH /api/signups/[id].
import { getSignupPackage, type SignupAppVersion } from "@/lib/signupPackages";

// Same choices as the marketing site's signup form (Website/src/components/SignupForm.tsx).
// "Coach" is what a Coach-plan signup is (one coach or trainer's business).
export const ORG_TYPES = ["Club", "School", "Association", "Academy", "League", "Community Group", "Coach"];

// Everything an admin can correct, in the order the page and the log show it.
export const SIGNUP_EDIT_FIELDS = [
  { key: "packageKey", label: "Package" },
  { key: "interval", label: "Billing" },
  { key: "trialDays", label: "Trial days" },
  { key: "appVersion", label: "App version" },
  { key: "clubName", label: "Club / organisation name" },
  { key: "registeredName", label: "Registered name" },
  { key: "orgType", label: "Organisation type" },
  { key: "sports", label: "Sports" },
  { key: "street", label: "Street" },
  { key: "suburb", label: "Suburb" },
  { key: "postcode", label: "Postcode" },
  { key: "requestedUrl", label: "Requested URL" },
  { key: "estimatedUsers", label: "Estimated users" },
  { key: "contactName", label: "Contact name" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
] as const;

export interface SignupEditData {
  packageKey: string;
  interval: string;
  trialDays: number;
  appVersion: SignupAppVersion;
  clubName: string;
  registeredName: string | null;
  orgType: string;
  sports: string[];
  street: string | null;
  suburb: string | null;
  postcode: string | null;
  requestedUrl: string | null;
  estimatedUsers: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
}

// The signup as it is now — its values are always allowed to stay, even if
// they're no longer on a list (a retired package or sport, an old org type).
export type CurrentSignup = Pick<SignupEditData, "packageKey" | "appVersion" | "orgType" | "sports">;

type Result = { ok: true; data: SignupEditData } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max: number): string | null {
  return text(value, max) || null;
}

function wholeNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

/** Checks an edit submitted from the signup page and returns the values to save. */
export function parseSignupEdit(body: unknown, current: CurrentSignup, catalogSports: string[]): Result {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const clubName = text(b.clubName, 120);
  if (!clubName) return { ok: false, error: "Club / organisation name can't be empty." };

  const contactName = text(b.contactName, 120);
  if (!contactName) return { ok: false, error: "Contact name can't be empty." };

  const contactEmail = text(b.contactEmail, 200).toLowerCase();
  if (!EMAIL_RE.test(contactEmail)) return { ok: false, error: "Contact email doesn't look like an email address." };

  const orgType = text(b.orgType, 60);
  if (!ORG_TYPES.includes(orgType) && orgType !== current.orgType) {
    return { ok: false, error: "Pick an organisation type from the list." };
  }

  const allowedSports = new Map([...catalogSports, ...current.sports].map((s) => [s.toLowerCase(), s]));
  const sports: string[] = [];
  for (const raw of Array.isArray(b.sports) ? b.sports : []) {
    const match = typeof raw === "string" ? allowedSports.get(raw.trim().toLowerCase()) : undefined;
    if (!match) return { ok: false, error: `"${String(raw)}" isn't on the sports list.` };
    if (!sports.includes(match)) sports.push(match);
  }
  if (sports.length === 0) return { ok: false, error: "Pick at least one sport." };

  const estimatedUsers = wholeNumber(b.estimatedUsers);
  if (estimatedUsers === null || estimatedUsers < 1 || estimatedUsers > 100_000) {
    return { ok: false, error: "Estimated users must be a whole number from 1 to 100,000." };
  }

  const packageKey = text(b.packageKey, 40);
  const pkg = getSignupPackage(packageKey);
  if (!pkg && packageKey !== current.packageKey) return { ok: false, error: "Pick a package from the list." };

  // Free Trial has no billing choice; the marketing site stores it as monthly too.
  const interval = pkg?.fixedInterval ? "monthly" : text(b.interval, 20);
  if (interval !== "monthly" && interval !== "yearly") return { ok: false, error: "Billing must be monthly or yearly." };

  const trialDays = wholeNumber(b.trialDays);
  if (trialDays === null || trialDays < 0 || trialDays > 365) {
    return { ok: false, error: "Trial days must be a whole number from 0 to 365." };
  }

  return {
    ok: true,
    data: {
      packageKey,
      interval,
      trialDays,
      // The package decides which modules the club starts with.
      appVersion: pkg?.appVersion ?? current.appVersion,
      clubName,
      registeredName: optionalText(b.registeredName, 120),
      orgType,
      sports,
      street: optionalText(b.street, 200),
      suburb: optionalText(b.suburb, 200),
      postcode: optionalText(b.postcode, 10),
      requestedUrl: optionalText(b.requestedUrl, 200),
      estimatedUsers,
      contactName,
      contactEmail,
      contactPhone: optionalText(b.contactPhone, 40),
    },
  };
}

// How the customer paid at checkout: nothing (Free Trial), the website's
// dummy test card, or a real Stripe subscription.
export type SignupPaymentKind = "none" | "dummy" | "stripe";

/**
 * Warnings to show before a package change is saved, because changing it
 * here only changes the club that approval creates — not what's been set up
 * for payment.
 */
export function packageChangeWarnings(
  paymentKind: SignupPaymentKind,
  from: { packageKey: string; interval: string },
  to: { packageKey: string; interval: string },
): string[] {
  if (from.packageKey === to.packageKey && from.interval === to.interval) return [];
  const warnings: string[] = [];
  const paidNow = getSignupPackage(to.packageKey)?.paid ?? true;
  if (paymentKind === "none" && paidNow) {
    warnings.push("This signup came in without payment details (Free Trial). Arrange payment with the club before approving it on a paid package.");
  }
  if (paymentKind === "stripe") {
    warnings.push("Stripe will keep charging the plan the customer picked at checkout. Change their subscription in the Stripe dashboard too.");
  }
  return warnings;
}
