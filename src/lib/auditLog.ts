// The platform console's change log ("Logs", /logs): what can be
// recorded and how a change is described. Pure and client-safe — the
// database side is in auditLog.server.ts.

export const AUDIT_ACTIONS = {
  "signup.edit": "Edited signup",
  "signup.approve": "Approved signup",
  "signup.reject": "Rejected signup",
  "club.create": "Created club",
  "club.edit": "Edited club",
  "club.deactivate": "Deactivated club",
  "club.reactivate": "Reactivated club",
  "club.delete": "Deleted club",
  "club.subdomain": "Set up subdomain",
  "club.setup_email": "Sent setup email",
  "sport.add": "Added sport",
  "sport.remove": "Removed sport",
  "word.add": "Added restricted word",
  "word.remove": "Removed restricted word",
  "staff.add": "Added portal user",
  "staff.edit": "Changed portal user",
  "staff.password": "Reset portal user's password",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditTargetType = "signup" | "club" | "sport" | "word" | "staff";

export type AuditValue = string | number | boolean | string[] | null;

export interface AuditChange {
  field: string;
  label: string;
  from: AuditValue;
  to: AuditValue;
}

export function auditActionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, string>)[action] ?? action;
}

// Treat "", null and undefined as the same "empty" value, so saving a form
// that turns a blank optional field from null into "" isn't logged as a change.
function normalise(value: unknown): AuditValue {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function same(a: AuditValue, b: AuditValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

/**
 * The fields that differ between `before` and `after`, in the order `fields`
 * lists them. Only listed fields are compared, so internal columns (ids,
 * timestamps, derived values) never show up in the log.
 */
export function diffFields(
  before: object,
  after: object,
  fields: readonly { key: string; label: string }[],
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const { key, label } of fields) {
    const from = normalise((before as Record<string, unknown>)[key]);
    const to = normalise((after as Record<string, unknown>)[key]);
    if (!same(from, to)) changes.push({ field: key, label, from, to });
  }
  return changes;
}

const DISPLAY_MAX = 300;

/** How a logged value reads on the Logs page. */
export function formatAuditValue(value: AuditValue): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  const text = String(value);
  return text.length > DISPLAY_MAX ? `${text.slice(0, DISPLAY_MAX)}…` : text;
}
