// Free service days (owner, 2026-10-21): when Squadino was unavailable (the app, the code, the database, the domain, anything we couldn't
// prevent), platform staff give clubs free days to make up for it. This file is the pure part: checking what staff typed, describing the
// days in words, and working out what the days do to a club's billing. No database, no Stripe, so all of it is unit-tested.
// Kept identical in the club app and ops (src/lib/freeDays.ts): change both together.

export const FREE_DAYS_MAX = 90; // a typo (a whole year picked by accident) is refused instead of given away
export const TITLE_MAX = 120;
export const TEXT_MIN = 10;
export const TEXT_MAX = 2000;
export const NOTE_MAX = 1000;
export const CLUBS_MAX = 2000;
// Days may be picked a little way into the past (the days that were lost) and up to a year ahead.
const PAST_WINDOW_DAYS = 180;
const FUTURE_WINDOW_DAYS = 366;
const DAY_MS = 86_400_000;

export interface FreeDaysClub {
  id: string;
  name: string;
}

export interface FreeDaysRequest {
  /** A short name for what happened, e.g. "Service interruption on 3 November". Used in the email's subject and the Logs. */
  title: string;
  /** Why it happened, in the admin's words. Sent to the customers. */
  whatHappened: string;
  /** What Squadino is doing to fix it. Sent to the customers. */
  whatWeAreDoing: string;
  /** Anything else to tell them. Optional. */
  extraNote: string | null;
  /** The free days, as YYYY-MM-DD, earliest first, no repeats. */
  dates: string[];
  clubs: FreeDaysClub[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD (2026-02-30 is not one). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

const todayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" });
/** Today's date (YYYY-MM-DD) in the club's home time zone, which is where the calendar's "today" is. */
export function melbourneToday(now: Date): string {
  return todayFormat.format(now);
}

/** The earliest and latest day that can be picked, as YYYY-MM-DD (counted from today in Melbourne). */
export function allowedDateRange(now: Date): { min: string; max: string } {
  const today = dayNumber(melbourneToday(now));
  const iso = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
  return { min: iso(today - PAST_WINDOW_DAYS), max: iso(today + FUTURE_WINDOW_DAYS) };
}

export interface DateRun {
  from: string;
  to: string;
  days: number;
}

/** The dates grouped into runs of consecutive days: 3, 4, 5 and 9 become 3 to 5 and 9. */
export function dateRuns(dates: readonly string[]): DateRun[] {
  const sorted = [...new Set(dates)].sort();
  const runs: DateRun[] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && dayNumber(d) - dayNumber(last.to) === 1) {
      last.to = d;
      last.days += 1;
    } else {
      runs.push({ from: d, to: d, days: 1 });
    }
  }
  return runs;
}

const dayPart = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", day: "numeric" });
const monthPart = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long" });
const yearPart = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", year: "numeric" });
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "3 November 2026", "3 to 5 November 2026", "30 November to 2 December 2026". */
export function describeRun(run: DateRun): string {
  const a = at(run.from);
  const b = at(run.to);
  const full = (d: Date) => `${dayPart.format(d)} ${monthPart.format(d)} ${yearPart.format(d)}`;
  if (run.from === run.to) return full(a);
  if (yearPart.format(a) === yearPart.format(b)) {
    if (monthPart.format(a) === monthPart.format(b)) return `${dayPart.format(a)} to ${full(b)}`;
    return `${dayPart.format(a)} ${monthPart.format(a)} to ${full(b)}`;
  }
  return `${full(a)} to ${full(b)}`;
}

/** "3 to 5 November 2026 and 10 November 2026". */
export function describeFreeDates(dates: readonly string[]): string {
  const parts = dateRuns(dates).map(describeRun);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function daysWord(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

type Parsed = { ok: true; value: FreeDaysRequest } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Checks what staff filled in: a title, what happened, what is being done about it, the free days and the clubs. The same checks
 * run where the request is made and again where it is carried out, so what was approved is what runs.
 */
export function parseFreeDaysRequest(body: unknown, now: Date): Parsed {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const title = text(b.title);
  if (!title) return { ok: false, error: "Give this a short title, for example \"Service interruption on 3 November\"." };
  if (title.length > TITLE_MAX) return { ok: false, error: `The title can be up to ${TITLE_MAX} characters.` };

  const whatHappened = text(b.whatHappened);
  if (whatHappened.length < TEXT_MIN) return { ok: false, error: "Say what happened and why, so the customers are told." };
  if (whatHappened.length > TEXT_MAX) return { ok: false, error: `"What happened" can be up to ${TEXT_MAX} characters.` };

  const whatWeAreDoing = text(b.whatWeAreDoing);
  if (whatWeAreDoing.length < TEXT_MIN) return { ok: false, error: "Say what Squadino is doing to fix it, so the customers are told." };
  if (whatWeAreDoing.length > TEXT_MAX) return { ok: false, error: `"What we're doing" can be up to ${TEXT_MAX} characters.` };

  const extraNote = text(b.extraNote) || null;
  if (extraNote && extraNote.length > NOTE_MAX) return { ok: false, error: `The extra note can be up to ${NOTE_MAX} characters.` };

  if (!Array.isArray(b.dates) || b.dates.length === 0) return { ok: false, error: "Pick at least one free day on the calendar." };
  const range = allowedDateRange(now);
  const dates: string[] = [];
  for (const raw of b.dates) {
    if (!isIsoDate(raw)) return { ok: false, error: "One of the free days isn't a real date." };
    if (raw < range.min || raw > range.max) {
      return { ok: false, error: `${describeRun({ from: raw, to: raw, days: 1 })} is too far from today. Free days can be up to ${PAST_WINDOW_DAYS} days back and a year ahead.` };
    }
    if (!dates.includes(raw)) dates.push(raw);
  }
  dates.sort();
  if (dates.length > FREE_DAYS_MAX) return { ok: false, error: `That is ${dates.length} free days. The most that can be given at once is ${FREE_DAYS_MAX}.` };

  if (!Array.isArray(b.clubs) || b.clubs.length === 0) return { ok: false, error: "Choose at least one club." };
  if (b.clubs.length > CLUBS_MAX) return { ok: false, error: `Too many clubs at once (the most is ${CLUBS_MAX}).` };
  const clubs: FreeDaysClub[] = [];
  const seen = new Set<string>();
  for (const raw of b.clubs) {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const id = text(c.id);
    const name = text(c.name);
    if (!id || id.length > 64 || !name) return { ok: false, error: "One of the clubs isn't valid." };
    if (seen.has(id)) continue;
    seen.add(id);
    clubs.push({ id, name: name.slice(0, 200) });
  }

  return { ok: true, value: { title, whatHappened, whatWeAreDoing, extraNote, dates, clubs } };
}

// ─── What the days do to a club's billing ─────────────────────────────────────────────────────────────────────────────────────

/** The few things about a Stripe subscription that decide whether, and to when, its payment can move. Times are Unix seconds. */
export interface SubscriptionTiming {
  status: string;
  trialEnd: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

export type StripePlan = { ok: true; oldEnd: Date; newEnd: Date } | { ok: false; error: string };

/**
 * A paying club's next payment moves out by the number of free days. A subscription still in its trial has its trial end moved; an
 * active one has its next payment date moved (Stripe does this by giving it a trial that ends on the new date, with no charge or
 * refund for the change). Anything else is left alone, and the reason says why, so staff can sort it out by hand.
 */
export function planSubscription(sub: SubscriptionTiming, days: number, nowMs: number): StripePlan {
  if (sub.status !== "active" && sub.status !== "trialing") {
    return { ok: false, error: `The subscription is ${sub.status.replace(/_/g, " ")}, so its payment date was not moved.` };
  }
  if (sub.cancelAtPeriodEnd) {
    return { ok: false, error: "The subscription is set to end at the end of the period already paid for, so its payment date was not moved." };
  }
  const base = sub.status === "trialing" && sub.trialEnd ? sub.trialEnd : sub.periodEnd;
  if (!base) return { ok: false, error: "Stripe didn't say when the next payment is due, so its payment date was not moved." };
  if (base * 1000 < nowMs - DAY_MS) return { ok: false, error: "The next payment date Stripe gave is already in the past, so it was not moved." };
  return { ok: true, oldEnd: new Date(base * 1000), newEnd: new Date(base * 1000 + days * DAY_MS) };
}

export type TrialPlan = { effect: "TRIAL"; oldEnd: Date; newEnd: Date } | { effect: "NONE" };

/** A club still on its free trial (not paying through Stripe) has the end of the trial moved out; anything else has nothing to move. */
export function planTrial(trialEndsAt: Date | null, days: number, now: Date): TrialPlan {
  if (!trialEndsAt || trialEndsAt.getTime() <= now.getTime()) return { effect: "NONE" };
  return { effect: "TRIAL", oldEnd: trialEndsAt, newEnd: new Date(trialEndsAt.getTime() + days * DAY_MS) };
}
