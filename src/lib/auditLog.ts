// The platform console's change log ("Logs", /logs): what can be
// recorded and how a change is described. Pure and client-safe — the
// database side is in auditLog.server.ts.

export const AUDIT_ACTIONS = {
  "signup.edit": "Edited signup",
  "signup.approve": "Approved signup",
  "signup.reject": "Rejected signup",
  "signup.preapprove": "Pre-approved signup",
  "signup.preapprove_declined": "Sent a pre-approved signup back for review",
  "signup.reject_requested": "Asked for a signup to be rejected",
  "signup.reinstate": "Re-instated signup",
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
  "request.create": "Asked for a change",
  "request.approve": "Approved a change request",
  "request.reject": "Rejected a change request",
  "package.edit": "Edited package",
  "billing.action": "Billing change (Stripe)",
  "billing.hold_offered": "Account hold offered to the customer",
  "billing.hold_extension_offered": "Hold extension offered to the customer",
  "billing.hold_extended": "Customer accepted a hold extension",
  "billing.hold_extension_declined": "Customer declined a hold extension",
  "billing.hold_expired": "Hold ran out: subscription ended, club switched off",
  "billing.hold_accepted": "Customer accepted the hold offer",
  "billing.hold_declined": "Customer declined the hold offer",
  "billing.hold_decision_sent": "End-of-hold choice emailed to the customer",
  "billing.hold_continue": "Customer chose to continue on their plan",
  "billing.hold_end_chosen": "Customer chose to end their subscription",
  "billing.hold_started": "Account hold started (Stripe)",
  "billing.hold_ended": "Account hold ended (Stripe)",
  "billing.hold_reminder": "Hold ending reminder sent",
  "billing.hold_resume_requested": "Hold ended: plan restored in Stripe",
  "billing.plan_change": "Plan changed (Stripe)",
  "billing.cancel_scheduled": "Cancellation scheduled (Stripe)",
  "billing.cancel_undone": "Cancellation undone (Stripe)",
  "billing.ended": "Subscription ended (Stripe)",
  "billing.payment_failed": "Payment failed (Stripe)",
  "billing.recovered": "Payment recovered (Stripe)",
  "staff.add": "Added portal user",
  "staff.edit": "Changed portal user",
  "staff.password": "Reset portal user's password",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditTargetType = "signup" | "club" | "sport" | "word" | "staff" | "package" | "request";

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

export const SEARCH_MAX_WORDS = 5;
export const SEARCH_WORD_MAX_LENGTH = 60;

/**
 * The words of a Logs search: split on spaces, lower-cased, no repeats, and capped so one huge pasted block can't
 * turn into a heavy database query. An entry has to match EVERY word (each word can match a different field).
 */
export function searchWords(input: unknown): string[] {
  if (typeof input !== "string") return [];
  const words = input.toLowerCase().split(/\s+/).map((w) => w.slice(0, SEARCH_WORD_MAX_LENGTH)).filter(Boolean);
  return [...new Set(words)].slice(0, SEARCH_MAX_WORDS);
}

/** The recorded actions a word stands for, by their wording ("approved" finds "signup.approve" and friends) or their code. */
export function actionsMatching(word: string): string[] {
  const w = word.toLowerCase();
  return Object.entries(AUDIT_ACTIONS)
    .filter(([key, label]) => key.includes(w) || label.toLowerCase().includes(w))
    .map(([key]) => key);
}

/** Makes a word safe to use inside a SQL LIKE pattern, so a typed % or _ is searched for literally. */
export function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => "\\" + c);
}

/**
 * The host of a web address someone typed ("https://www.walkerscc.squadino.com/login" -> "walkerscc.squadino.com"), or
 * null if the word isn't one. Needs a dot, so ordinary words and names are never taken for web addresses.
 */
export function urlHost(word: string): string | null {
  const host = word
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

/** "walkerscc.squadino.com" -> "walkerscc" for a club's own address; null for anything else. */
export function slugOfHost(host: string, rootDomain: string): string | null {
  const suffix = `.${rootDomain.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

export interface CalendarDay {
  y: number;
  m: number;
  d: number;
}

function realDay(y: number, m: number, d: number): CalendarDay | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { y, m, d } : null;
}

/** A calendar date typed the Australian way (9/10/2026, 09-10-2026, 9.10.2026) or as 2026-10-09; null if it isn't a real date. */
export function parseDayWord(word: string): CalendarDay | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
  if (iso) return realDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(word);
  if (dmy) return realDay(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return null;
}

const melbourneParts = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// How far Melbourne's clock is ahead of UTC at an instant (10 or 11 hours, depending on daylight saving).
function melbourneOffsetMs(instant: number): number {
  const parts = melbourneParts.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The instant a calendar day starts in Melbourne (the Logs are shown in Melbourne time). */
export function melbourneDayStart({ y, m, d }: CalendarDay): Date {
  const guess = Date.UTC(y, m - 1, d);
  // Done twice so a day on which the clocks change still lands on its real midnight.
  const first = guess - melbourneOffsetMs(guess);
  return new Date(guess - melbourneOffsetMs(first));
}

/** From the start of `from` up to (not including) the start of the day after `to`. */
export function melbourneRange(from: CalendarDay | null, to: CalendarDay | null): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = melbourneDayStart(from);
  if (to) {
    const next = new Date(Date.UTC(to.y, to.m - 1, to.d + 1));
    range.lt = melbourneDayStart({ y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() });
  }
  return range;
}

/** The value of a date box (2026-10-09), or null. */
export function parseDateInput(value: unknown): CalendarDay | null {
  const m = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? realDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

const TASK_GROUPS: Record<string, string> = {
  signup: "Signups",
  club: "Clubs (status, subdomain, setup email)",
  billing: "Billing and account hold",
  request: "Approval requests",
  package: "Settings",
  sport: "Settings",
  word: "Settings",
  staff: "Portal users",
};

/** The tasks that can be picked in the Logs filter, grouped, with their wording. */
export function taskOptions(): { group: string; tasks: { key: string; label: string }[] }[] {
  const groups = new Map<string, { key: string; label: string }[]>();
  for (const [key, label] of Object.entries(AUDIT_ACTIONS)) {
    const group = TASK_GROUPS[key.split(".")[0]] ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), { key, label }]);
  }
  return [...groups].map(([group, tasks]) => ({ group, tasks }));
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && value in AUDIT_ACTIONS;
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
