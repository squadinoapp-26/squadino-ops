// Changes that need an admin's sign-off. Super admins and admins make them directly; moderators and
// customer care send a request that an admin approves or rejects (see /approvals). Pure, so the
// rules are unit-tested without a database.

export const CHANGE_TYPES = {
  PLAN_CHANGE: "Change plan or user limit",
  HOLD_START: "Offer account hold to the customer",
  HOLD_EXTEND: "Offer a longer hold (1 or 2 months)",
  HOLD_RESUME: "Resume from account hold",
  SUBSCRIPTION_CANCEL: "Cancel subscription",
  PACKAGE_EDIT: "Edit package price or limit",
} as const;

export type ChangeType = keyof typeof CHANGE_TYPES;

export function isChangeType(value: unknown): value is ChangeType {
  return typeof value === "string" && value in CHANGE_TYPES;
}

export const REASON_MAX = 500;

/** A tidy optional reason, or null. */
export function cleanReason(value: unknown): string | null {
  return typeof value === "string" ? value.trim().slice(0, REASON_MAX) || null : null;
}

/** The action the club app runs for the billing request types, or null for the others. */
export function billingActionFor(type: ChangeType): "offer_hold" | "offer_extension" | "resume" | "cancel" | null {
  if (type === "HOLD_EXTEND") return "offer_extension";
  if (type === "HOLD_START") return "offer_hold";
  if (type === "HOLD_RESUME") return "resume";
  if (type === "SUBSCRIPTION_CANCEL") return "cancel";
  return null;
}

export interface ExtensionPayload {
  months: 1 | 2;
}

export interface PlanChangePayload {
  packageId?: string | null;
  userCapOverride?: number | null;
}

export interface PackageEditPayload {
  packageId: string;
  name: string;
  userCap: number | null;
  priceCents: number;
  trialDays: number | null;
  active: boolean;
}

type Parsed<T> = { ok: true; payload: T } | { ok: false; error: string };

/** A hold extension is 1 or 2 more months at the same price. */
export function parseExtension(body: unknown): Parsed<ExtensionPayload> {
  const months = (body && typeof body === "object" ? (body as Record<string, unknown>).months : undefined);
  if (months !== 1 && months !== 2) return { ok: false, error: "An extension is 1 or 2 months." };
  return { ok: true, payload: { months } };
}

/** What a plan or user-limit change asks for: a package and/or a user-limit override. */
export function parsePlanChange(body: unknown): Parsed<PlanChangePayload> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const payload: PlanChangePayload = {};

  if ("packageId" in b) {
    if (b.packageId === null || b.packageId === "") payload.packageId = null;
    else if (typeof b.packageId === "string") payload.packageId = b.packageId;
    else return { ok: false, error: "Invalid package" };
  }
  if ("userCapOverride" in b) {
    if (b.userCapOverride === null) payload.userCapOverride = null;
    else if (typeof b.userCapOverride === "number" && Number.isInteger(b.userCapOverride) && b.userCapOverride >= 1) payload.userCapOverride = b.userCapOverride;
    else return { ok: false, error: "User cap override must be a positive whole number, or blank to remove the override" };
  }
  if (!("packageId" in payload) && !("userCapOverride" in payload)) return { ok: false, error: "Nothing to change" };
  return { ok: true, payload };
}

/** A package's new name, price, user limit and trial: the same rules the package editor uses. */
export function parsePackageEdit(packageId: string, body: unknown): Parsed<PackageEditPayload> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) return { ok: false, error: "Name is required" };
  if (b.userCap !== null && (typeof b.userCap !== "number" || b.userCap < 1)) {
    return { ok: false, error: "User cap must be a positive number, or blank for unlimited" };
  }
  if (typeof b.priceCents !== "number" || b.priceCents < 0) return { ok: false, error: "Price must be zero or more" };
  if (b.trialDays !== null && (typeof b.trialDays !== "number" || b.trialDays < 0)) {
    return { ok: false, error: "Trial days must be zero or more, or blank for no trial" };
  }
  return {
    ok: true,
    payload: {
      packageId,
      name: b.name.trim(),
      userCap: b.userCap as number | null,
      priceCents: b.priceCents,
      trialDays: b.trialDays as number | null,
      active: !!b.active,
    },
  };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** One line saying what a request would do, for the Approvals list. */
export function describeChange(type: ChangeType, payload: unknown, packageNames: Record<string, string> = {}): string {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  switch (type) {
    case "PLAN_CHANGE": {
      const parts: string[] = [];
      if ("packageId" in p) parts.push(p.packageId ? `package: ${packageNames[p.packageId as string] ?? "another package"}` : "package: none");
      if ("userCapOverride" in p) parts.push(p.userCapOverride === null ? "remove the user-limit override" : `user limit: ${p.userCapOverride}`);
      return parts.join("; ");
    }
    case "PACKAGE_EDIT":
      return `${p.name ?? "Package"}: ${typeof p.priceCents === "number" ? money(p.priceCents) : "?"}/mo, ${p.userCap ? `${p.userCap} users` : "unlimited users"}${p.active === false ? ", inactive" : ""}`;
    case "HOLD_START":
      return "Email the customer an offer to move to the $50/month hold price for up to 3 months with fewer features (no Wall, Chat, Training or Stats, no new members). Nothing changes unless they accept";
    case "HOLD_EXTEND":
      return `Email the customer an offer to extend their hold by ${p.months === 2 ? 2 : 1} more month${p.months === 2 ? "s" : ""} at the same $50/month. Nothing changes unless they accept`;
    case "HOLD_RESUME":
      return "End the hold now: back to the plan and price it was on, with all features";
    case "SUBSCRIPTION_CANCEL":
      return "Cancel the subscription at the end of the period already paid for";
  }
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FAILED: "Approved, but could not be applied",
};
