import { describe, expect, it } from "vitest";
import { dollarsToCents, formatMoney, fullPeriodCents, fullQuoteProblem, parseFullAction } from "./fullPackage";

describe("Full package money (a copy of the club app's rules)", () => {
  it("monthly is members times the price; yearly is 12 months less 5%", () => {
    expect(fullPeriodCents(1200, 30, "monthly")).toBe(36000);
    expect(fullPeriodCents(1200, 30, "yearly")).toBe(410400);
    expect(fullPeriodCents(1001, 33, "yearly")).toBe(376576);
  });

  it("matches the website's formula (monthly x 12 x 0.95, rounded)", () => {
    for (let users = 1001; users < 1400; users += 11) {
      for (const perMember of [1, 7, 25, 30, 33, 99, 250, 1000]) {
        expect(fullPeriodCents(users, perMember, "yearly")).toBe(Math.round(users * perMember * 12 * (1 - 0.05)));
      }
    }
  });

  it("formats and parses dollars", () => {
    expect(formatMoney(30)).toBe("$0.30");
    expect(formatMoney(36000)).toBe("$360");
    expect(formatMoney(410450)).toBe("$4,104.50");
    expect(dollarsToCents("0.30")).toBe(30);
    expect(dollarsToCents("$0.3")).toBe(30);
    expect(dollarsToCents("0.305")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
  });

  it("needs more than 1,000 members and a sensible price", () => {
    expect(fullQuoteProblem(1000, 30)).toMatch(/more than 1,000/);
    expect(fullQuoteProblem(1001, 30)).toBeNull();
    expect(fullQuoteProblem(1200.5, 30)).not.toBeNull();
    expect(fullQuoteProblem(1200, 0)).not.toBeNull();
    expect(fullQuoteProblem(1200, 3000)).toMatch(/check the price/);
  });
});

describe("parseFullAction", () => {
  const ok = { action: "send_invoice", users: "1,200", price: "0.30", note: "Agreed on the phone" };

  it("turns what the admin typed into numbers", () => {
    expect(parseFullAction(ok)).toEqual({ ok: true, action: { kind: "send_invoice", users: 1200, perMemberCents: 30, note: "Agreed on the phone" } });
    expect(parseFullAction({ ...ok, users: 1200 })).toMatchObject({ ok: true });
  });

  it("refuses 1,000 members or fewer, a missing or odd price, and a missing reason", () => {
    expect(parseFullAction({ ...ok, users: "1000" })).toMatchObject({ ok: false, error: expect.stringMatching(/more than 1,000/) });
    expect(parseFullAction({ ...ok, users: "lots" })).toMatchObject({ ok: false });
    expect(parseFullAction({ ...ok, price: "" })).toMatchObject({ ok: false });
    expect(parseFullAction({ ...ok, price: "0.305" })).toMatchObject({ ok: false });
    expect(parseFullAction({ ...ok, price: "30" })).toMatchObject({ ok: false, error: expect.stringMatching(/check the price/) });
    expect(parseFullAction({ ...ok, note: "  " })).toMatchObject({ ok: false, error: expect.stringMatching(/reason or note/) });
  });

  it("cancelling and closing always need a reason", () => {
    expect(parseFullAction({ action: "cancel_invoice", note: "Wrong price" })).toEqual({ ok: true, action: { kind: "cancel_invoice", note: "Wrong price" } });
    expect(parseFullAction({ action: "cancel_invoice" })).toMatchObject({ ok: false });
    expect(parseFullAction({ action: "close", note: "Not a real club" })).toEqual({ ok: true, action: { kind: "close", note: "Not a real club" } });
    expect(parseFullAction({ action: "close" })).toMatchObject({ ok: false });
    expect(parseFullAction({ action: "delete", note: "x" })).toMatchObject({ ok: false });
    expect(parseFullAction(null)).toMatchObject({ ok: false });
  });
});
