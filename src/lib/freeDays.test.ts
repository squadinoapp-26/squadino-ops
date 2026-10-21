import { describe, it, expect } from "vitest";
import {
  FREE_DAYS_MAX, allowedDateRange, dateRuns, daysWord, describeFreeDates, isIsoDate, melbourneToday, parseFreeDaysRequest, planSubscription, planTrial,
} from "./freeDays";

// 21 October 2026, midday in Melbourne.
const NOW = new Date("2026-10-21T02:00:00Z");

const good = {
  title: "Service interruption on 3 November",
  whatHappened: "Our database provider had an outage and the app could not load.",
  whatWeAreDoing: "We moved to a second database region and added an alert.",
  dates: ["2026-11-03", "2026-11-04"],
  clubs: [{ id: "c1", name: "Otters FC" }],
};

describe("isIsoDate", () => {
  it("accepts real dates and refuses anything else", () => {
    expect(isIsoDate("2026-11-03")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "3 Nov 2026", "2026-1-3", "", null, undefined, 20261103, {}]) expect(isIsoDate(bad)).toBe(false);
  });
});

describe("melbourneToday", () => {
  it("is the date in Melbourne, which can be a day ahead of UTC", () => {
    expect(melbourneToday(new Date("2026-10-20T20:00:00Z"))).toBe("2026-10-21");
    expect(melbourneToday(new Date("2026-10-21T02:00:00Z"))).toBe("2026-10-21");
  });
});

describe("allowedDateRange", () => {
  it("is 180 days back to a year (366 days) ahead of today in Melbourne", () => {
    expect(allowedDateRange(NOW)).toEqual({ min: "2026-04-24", max: "2027-10-22" });
  });
});

describe("dateRuns and describeFreeDates", () => {
  it("groups consecutive days, ignoring order and repeats", () => {
    expect(dateRuns(["2026-11-05", "2026-11-03", "2026-11-04", "2026-11-04", "2026-11-09"])).toEqual([
      { from: "2026-11-03", to: "2026-11-05", days: 3 },
      { from: "2026-11-09", to: "2026-11-09", days: 1 },
    ]);
  });

  it("writes them in words", () => {
    expect(describeFreeDates(["2026-11-03"])).toBe("3 November 2026");
    expect(describeFreeDates(["2026-11-03", "2026-11-04", "2026-11-05"])).toBe("3 to 5 November 2026");
    expect(describeFreeDates(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-10"])).toBe("3 to 5 November 2026 and 10 November 2026");
    expect(describeFreeDates(["2026-11-30", "2026-12-01", "2026-12-02"])).toBe("30 November to 2 December 2026");
    expect(describeFreeDates(["2026-12-30", "2026-12-31", "2027-01-01"])).toBe("30 December 2026 to 1 January 2027");
    expect(describeFreeDates(["2026-11-03", "2026-11-10", "2026-11-20"])).toBe("3 November 2026, 10 November 2026 and 20 November 2026");
    expect(describeFreeDates([])).toBe("");
  });

  it("counts days in words", () => {
    expect(daysWord(1)).toBe("1 day");
    expect(daysWord(3)).toBe("3 days");
  });
});

describe("parseFreeDaysRequest", () => {
  it("accepts a complete request and tidies it", () => {
    const r = parseFreeDaysRequest({ ...good, title: "  Service interruption on 3 November ", dates: ["2026-11-04", "2026-11-03", "2026-11-03"], clubs: [good.clubs[0], good.clubs[0], { id: "c2", name: "Lions" }] }, NOW);
    expect(r).toEqual({
      ok: true,
      value: { title: "Service interruption on 3 November", whatHappened: good.whatHappened, whatWeAreDoing: good.whatWeAreDoing, extraNote: null, dates: ["2026-11-03", "2026-11-04"], clubs: [good.clubs[0], { id: "c2", name: "Lions" }] },
    });
  });

  it("keeps an optional extra note", () => {
    const r = parseFreeDaysRequest({ ...good, extraNote: " Thank you for staying with us. " }, NOW);
    expect(r.ok && r.value.extraNote).toBe("Thank you for staying with us.");
  });

  it("asks for each missing piece, in plain words", () => {
    const error = (patch: Record<string, unknown>) => {
      const r = parseFreeDaysRequest({ ...good, ...patch }, NOW);
      return r.ok ? null : r.error;
    };
    expect(error({ title: "  " })).toMatch(/title/i);
    expect(error({ whatHappened: "short" })).toMatch(/what happened/i);
    expect(error({ whatWeAreDoing: "" })).toMatch(/fix it/i);
    expect(error({ dates: [] })).toMatch(/free day/i);
    expect(error({ clubs: [] })).toMatch(/club/i);
    expect(error({ clubs: [{ id: "", name: "x" }] })).toMatch(/clubs isn't valid/);
    expect(error({ title: "x".repeat(121) })).toMatch(/120/);
    expect(error({ whatHappened: "x".repeat(2001) })).toMatch(/2000/);
    expect(error({ extraNote: "x".repeat(1001) })).toMatch(/1000/);
  });

  it("refuses dates that are not real, or too far from today", () => {
    const bad = (dates: unknown) => {
      const r = parseFreeDaysRequest({ ...good, dates }, NOW);
      return r.ok ? null : r.error;
    };
    expect(bad(["2026-02-30"])).toMatch(/real date/);
    expect(bad(["tomorrow"])).toMatch(/real date/);
    expect(bad("2026-11-03")).toMatch(/at least one/);
    expect(bad(["2028-01-01"])).toMatch(/too far/);
    expect(bad(["2025-01-01"])).toMatch(/too far/);
    expect(bad(["2026-05-01"])).toBeNull(); // about five and a half months back: the days that were lost
  });

  it("refuses more than the most free days at once", () => {
    const many = Array.from({ length: FREE_DAYS_MAX + 1 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
    const r = parseFreeDaysRequest({ ...good, dates: many }, NOW);
    expect(r.ok).toBe(false);
    expect(parseFreeDaysRequest({ ...good, dates: many.slice(0, FREE_DAYS_MAX) }, NOW).ok).toBe(true);
  });

  it("does not throw on junk", () => {
    for (const junk of [null, undefined, 5, "x", [], { dates: "no" }]) expect(parseFreeDaysRequest(junk, NOW).ok).toBe(false);
  });
});

describe("planSubscription", () => {
  const DAY = 86_400;
  const now = Date.parse("2026-10-21T00:00:00Z");
  const periodEnd = Math.floor(Date.parse("2026-11-14T00:00:00Z") / 1000);

  it("moves an active subscription's next payment out by the free days", () => {
    const plan = planSubscription({ status: "active", trialEnd: null, periodEnd, cancelAtPeriodEnd: false }, 3, now);
    expect(plan).toEqual({ ok: true, oldEnd: new Date("2026-11-14T00:00:00Z"), newEnd: new Date("2026-11-17T00:00:00Z") });
  });

  it("moves a trial's end when the subscription is still in its trial", () => {
    const trialEnd = periodEnd - 10 * DAY;
    const plan = planSubscription({ status: "trialing", trialEnd, periodEnd, cancelAtPeriodEnd: false }, 2, now);
    expect(plan.ok && plan.oldEnd.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(plan.ok && plan.newEnd.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("leaves a subscription alone, and says why, when its payment can't simply move", () => {
    const why = (sub: Partial<Parameters<typeof planSubscription>[0]>) => {
      const p = planSubscription({ status: "active", trialEnd: null, periodEnd, cancelAtPeriodEnd: false, ...sub }, 3, now);
      return p.ok ? null : p.error;
    };
    expect(why({ status: "past_due" })).toMatch(/past due/);
    expect(why({ status: "canceled" })).toMatch(/canceled/);
    expect(why({ cancelAtPeriodEnd: true })).toMatch(/set to end/);
    expect(why({ periodEnd: null })).toMatch(/didn't say/);
    expect(why({ periodEnd: Math.floor(now / 1000) - 5 * DAY })).toMatch(/in the past/);
    expect(why({})).toBeNull();
  });
});

describe("planTrial", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  it("moves the end of a trial that is still running", () => {
    expect(planTrial(new Date("2026-10-30T00:00:00Z"), 3, now)).toEqual({ effect: "TRIAL", oldEnd: new Date("2026-10-30T00:00:00Z"), newEnd: new Date("2026-11-02T00:00:00Z") });
  });
  it("has nothing to move when there is no trial, or it has already ended", () => {
    expect(planTrial(null, 3, now)).toEqual({ effect: "NONE" });
    expect(planTrial(new Date("2026-10-01T00:00:00Z"), 3, now)).toEqual({ effect: "NONE" });
    expect(planTrial(now, 3, now)).toEqual({ effect: "NONE" });
  });
});
