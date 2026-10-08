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
  SIGNUP_REJECT: "Reject a new signup",
  SIGNUP_PREAPPROVE: "Pre-approve a new signup",
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

export interface SignupRejectPayload {
  signupId: string;
  reason: string;
}

export interface SignupPreApprovePayload {
  signupId: string;
  // The club's web address as the pre-approver picked it; the admin can change it when they approve.
  slug?: string;
  paymentChecked: boolean;
  notes: string | null;
}

// Both signup requests are decided by an admin, who always gives a written reason, approving or not.
export function decisionNoteRequired(type: string): boolean {
  return type === "SIGNUP_REJECT" || type === "SIGNUP_PREAPPROVE";
}

type Parsed<T> = { ok: true; payload: T } | { ok: false; error: string };

/**
 * A moderator or customer care officer pre-approves a signup: they have checked it (and, for a paid plan, its
 * payment in Stripe) and may leave notes for the admin, who makes the final approval.
 */
export function parseSignupPreApprove(signupId: string, body: unknown, opts: { needsPaymentCheck: boolean }): Parsed<SignupPreApprovePayload> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (opts.needsPaymentCheck && b.paymentChecked !== true) {
    return { ok: false, error: "Confirm you've checked this signup's payment first." };
  }
  const slug = typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : undefined;
  return { ok: true, payload: { signupId, ...(slug ? { slug } : {}), paymentChecked: b.paymentChecked === true, notes: cleanReason(b.notes) } };
}

/** Rejecting a signup always needs a written reason, so an admin can judge it. */
export function parseSignupReject(signupId: string, reasonInput: unknown): Parsed<SignupRejectPayload> {
  const reason = cleanReason(reasonInput);
  if (!reason) return { ok: false, error: "Give a reason for rejecting this signup." };
  return { ok: true, payload: { signupId, reason } };
}

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
      return "Email the customer an offer to move to the $50/month hold price for up to 3 months with fewer features (no Wall or Chat, no new members). Nothing changes unless they accept";
    case "HOLD_EXTEND":
      return `Email the customer an offer to extend their hold by ${p.months === 2 ? 2 : 1} more month${p.months === 2 ? "s" : ""} at the same $50/month. Nothing changes unless they accept`;
    case "HOLD_RESUME":
      return "End the hold now: back to the plan and price it was on, with all features";
    case "SUBSCRIPTION_CANCEL":
      return "Cancel the subscription at the end of the period already paid for";
    case "SIGNUP_REJECT":
      return "Reject this new signup. Approve it and the signup is rejected; re-instate it and it goes back to the signups waiting for review";
    case "SIGNUP_PREAPPROVE":
      return `Create the club for this new signup${typeof p.slug === "string" && p.slug ? ` at ${p.slug}.squadino.com` : ""}. Approve it and the club is created; send it back and the signup returns to the signups waiting for review`;
  }
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FAILED: "Approved, but could not be applied",
};

/** The status wording for a request; a rejected signup request means the signup was re-instated. */
export function requestStatusLabel(type: string, status: string): string {
  if (type === "SIGNUP_REJECT") {
    if (status === "APPROVED") return "Rejection approved";
    if (status === "REJECTED") return "Signup re-instated";
  }
  if (type === "SIGNUP_PREAPPROVE") {
    if (status === "APPROVED") return "Approved: club created";
    if (status === "REJECTED") return "Sent back for review";
  }
  return REQUEST_STATUS_LABELS[status] ?? status;
}
