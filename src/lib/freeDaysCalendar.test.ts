import { describe, it, expect } from "vitest";
import { datesBetween, longDayName, monthGrid, monthTitle, shiftMonth, toggled, withRange } from "./freeDaysCalendar";

describe("monthGrid", () => {
  it("starts on a Monday and fills whole weeks around the month", () => {
    const weeks = monthGrid(2026, 10); // November 2026 begins on a Sunday
    expect(weeks[0][0].iso).toBe("2026-10-26");
    expect(weeks[0][6]).toEqual({ iso: "2026-11-01", inMonth: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const inMonth = weeks.flat().filter((d) => d.inMonth).map((d) => d.iso);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0]).toBe("2026-11-01");
    expect(inMonth[29]).toBe("2026-11-30");
  });

  it("has no empty last week, and copes with February and leap years", () => {
    expect(monthGrid(2027, 1)).toHaveLength(4); // February 2027 is exactly four Monday-to-Sunday weeks
    expect(monthGrid(2026, 1)).toHaveLength(5); // February 2026 starts on a Sunday, so it needs a fifth week
    expect(monthGrid(2024, 1).flat().filter((d) => d.inMonth)).toHaveLength(29);
    for (const w of monthGrid(2026, 9)) expect(w).toHaveLength(7);
    expect(monthGrid(2026, 9).at(-1)!.some((d) => d.inMonth)).toBe(true);
  });
});

describe("dates", () => {
  it("lists every day between two dates, in either order", () => {
    expect(datesBetween("2026-11-03", "2026-11-05")).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(datesBetween("2026-11-05", "2026-11-03")).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(datesBetween("2026-12-31", "2027-01-01")).toEqual(["2026-12-31", "2027-01-01"]);
    expect(datesBetween("2026-11-03", "2026-11-03")).toEqual(["2026-11-03"]);
  });

  it("toggles a day on and off, keeping the list in order", () => {
    expect(toggled(["2026-11-05"], "2026-11-03")).toEqual(["2026-11-03", "2026-11-05"]);
    expect(toggled(["2026-11-03", "2026-11-05"], "2026-11-03")).toEqual(["2026-11-05"]);
  });

  it("adds a range without repeating days", () => {
    expect(withRange(["2026-11-04"], "2026-11-03", "2026-11-05")).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
  });

  it("moves between months and years, and names them", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
    expect(monthTitle(2026, 10)).toBe("November 2026");
    expect(longDayName("2026-11-03")).toBe("Tuesday 3 November 2026");
  });
});
