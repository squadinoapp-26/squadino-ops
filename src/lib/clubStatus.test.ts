import { describe, it, expect } from "vitest";
import { deletableFrom, canDeleteClub, monthsBetween } from "./clubStatus";

const d = (iso: string) => new Date(iso);

describe("deletableFrom", () => {
  it("is 12 calendar months after deactivation", () => {
    expect(deletableFrom(d("2026-09-28T01:00:00Z")).toISOString()).toBe("2027-09-28T01:00:00.000Z");
  });

  it("stays on the last day of the month for 29 February", () => {
    expect(deletableFrom(d("2028-02-29T00:00:00Z")).toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
});

describe("canDeleteClub", () => {
  const deactivatedAt = d("2026-09-28T01:00:00Z");

  it("waits until 12 months after deactivation", () => {
    expect(canDeleteClub({ active: false, deactivatedAt }, d("2027-09-28T00:59:59Z"))).toBe(false);
    expect(canDeleteClub({ active: false, deactivatedAt }, d("2027-09-28T01:00:00Z"))).toBe(true);
    expect(canDeleteClub({ active: false, deactivatedAt }, d("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("never deletes an active club", () => {
    expect(canDeleteClub({ active: true, deactivatedAt }, d("2030-01-01T00:00:00Z"))).toBe(false);
  });

  it("doesn't delete when the deactivation date isn't known", () => {
    expect(canDeleteClub({ active: false, deactivatedAt: null }, d("2030-01-01T00:00:00Z"))).toBe(false);
  });

  it("lets a never-used club go as soon as it's deactivated", () => {
    const justNow = d("2026-09-28T02:00:00Z");
    expect(canDeleteClub({ active: false, deactivatedAt: justNow, neverUsed: true }, justNow)).toBe(true);
    expect(canDeleteClub({ active: false, deactivatedAt: null, neverUsed: true }, justNow)).toBe(true);
  });

  it("still won't delete a never-used club while it's active", () => {
    expect(canDeleteClub({ active: true, deactivatedAt: null, neverUsed: true })).toBe(false);
  });
});

describe("monthsBetween", () => {
  it("counts whole months", () => {
    expect(monthsBetween(d("2026-09-28T00:00:00Z"), d("2026-09-30T00:00:00Z"))).toBe(0);
    expect(monthsBetween(d("2026-09-28T00:00:00Z"), d("2026-10-27T00:00:00Z"))).toBe(0);
    expect(monthsBetween(d("2026-09-28T00:00:00Z"), d("2026-10-28T00:00:00Z"))).toBe(1);
    expect(monthsBetween(d("2026-09-28T00:00:00Z"), d("2027-09-28T00:00:00Z"))).toBe(12);
  });
});
