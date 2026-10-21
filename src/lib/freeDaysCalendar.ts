// The month grid behind the free-days calendar on the ops screen. Pure (plain UTC dates written YYYY-MM-DD, never a time of day), so the
// grid can be tested and a day never slips a day when someone's computer is in another time zone.

const DAY_MS = 86_400_000;

export const isoOf = (d: Date): string => d.toISOString().slice(0, 10);
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

export interface GridDay {
  iso: string;
  inMonth: boolean;
}

/** The weeks shown for a month (Monday first), including the days from the neighbouring months that fill the first and last week. */
export function monthGrid(year: number, monthIndex: number): GridDay[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getTime() - lead * DAY_MS);
  const weeks: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      week.push({ iso: isoOf(day), inMonth: day.getUTCMonth() === monthIndex });
    }
    weeks.push(week);
  }
  // Drop the weeks at the end that hold none of the month's days (a month can fit in four or five weeks).
  while (!weeks[weeks.length - 1].some((d) => d.inMonth)) weeks.pop();
  return weeks;
}

/** Every date from `a` to `b` inclusive, whichever comes first. */
export function datesBetween(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const out: string[] = [];
  for (let t = at(from).getTime(); t <= at(to).getTime(); t += DAY_MS) out.push(isoOf(new Date(t)));
  return out;
}

/** The month before or after `(year, monthIndex)`. */
export function shiftMonth(year: number, monthIndex: number, by: number): { year: number; monthIndex: number } {
  const d = new Date(Date.UTC(year, monthIndex + by, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

const monthName = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long", year: "numeric" });
export const monthTitle = (year: number, monthIndex: number): string => monthName.format(new Date(Date.UTC(year, monthIndex, 1)));

const longDay = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** "Tuesday 3 November 2026", for a screen reader. */
export const longDayName = (iso: string): string => longDay.format(at(iso)).replace(",", "");

/** The dates with `iso` switched on or off. */
export function toggled(dates: readonly string[], iso: string): string[] {
  return dates.includes(iso) ? dates.filter((d) => d !== iso) : [...dates, iso].sort();
}

/** The dates with every day from `anchor` to `iso` added. */
export function withRange(dates: readonly string[], anchor: string, iso: string): string[] {
  return [...new Set([...dates, ...datesBetween(anchor, iso)])].sort();
}
