// The Full package: for organisations with more than 1,000 members, priced per member by agreement. Pure and
// client-safe (the page shows the total live as the admin types). The money rules are a copy of the club app's
// src/lib/fullPackage.ts, which is what the invoice is really made from: keep them identical.
//
// Only admins and super admins set the number of members and the price per member, send the invoice, cancel it or
// close a request (see canManageFullPackage in auth.ts), and they always give a written reason.

import { cleanReason } from "@/lib/changeRequests";

export const FULL_MIN_MEMBERS = 1001;
export const FULL_MAX_MEMBERS = 1_000_000;
export const FULL_MAX_PER_MEMBER_CENTS = 1000;
// Yearly is 12 months less 5%, the same as every other plan.
export const FULL_YEARLY_PERCENT_OF_12_MONTHS = 95;

export type FullInterval = "monthly" | "yearly";

export function fullMonthlyCents(users: number, perMemberCents: number): number {
  return users * perMemberCents;
}

/** What one invoice is for, in cents: monthly is members x price; yearly is 12 months less 5%, to the cent. */
export function fullPeriodCents(users: number, perMemberCents: number, interval: FullInterval): number {
  const monthly = fullMonthlyCents(users, perMemberCents);
  return interval === "yearly" ? Math.round((monthly * 12 * FULL_YEARLY_PERCENT_OF_12_MONTHS) / 100) : monthly;
}

/** "$0.30", "$1,234.50", "$360": dollars with cents only when there are some. */
export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "0.30" / "$0.30" / "0.3" to 30 cents; null if it isn't a price with at most two decimals. */
export function dollarsToCents(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  const m = /^\$?\s*(\d{1,4})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
}

/** A reason the numbers can't be used, or null. */
export function fullQuoteProblem(users: unknown, perMemberCents: unknown): string | null {
  if (typeof users !== "number" || !Number.isInteger(users)) return "Enter the number of members as a whole number.";
  if (users < FULL_MIN_MEMBERS) return `The Full package is for more than 1,000 members, so enter ${FULL_MIN_MEMBERS.toLocaleString("en-AU")} or more.`;
  if (users > FULL_MAX_MEMBERS) return `That is more than ${FULL_MAX_MEMBERS.toLocaleString("en-AU")} members: check the number.`;
  if (typeof perMemberCents !== "number" || !Number.isInteger(perMemberCents) || perMemberCents < 1) return "Enter the price per member per month, such as 0.30.";
  if (perMemberCents > FULL_MAX_PER_MEMBER_CENTS) return `That is more than ${formatMoney(FULL_MAX_PER_MEMBER_CENTS)} per member a month: check the price.`;
  return null;
}

export type FullAction =
  | { kind: "send_invoice"; users: number; perMemberCents: number; note: string }
  | { kind: "cancel_invoice"; note: string }
  | { kind: "close"; note: string };

type Parsed = { ok: true; action: FullAction } | { ok: false; error: string };

/**
 * What an admin sent from the Full package box. Every action needs a written reason (the owner's rule for every
 * admin decision); sending an invoice also needs the number of members and the price per member per month in dollars.
 */
export function parseFullAction(body: unknown): Parsed {
  const b = (body ?? {}) as { action?: unknown; users?: unknown; price?: unknown; note?: unknown };
  const note = cleanReason(b.note);
  if (b.action === "send_invoice") {
    const users = typeof b.users === "string" ? Number(b.users.replace(/,/g, "").trim()) : b.users;
    const perMemberCents = dollarsToCents(b.price);
    if (perMemberCents === null) return { ok: false, error: "Enter the price per member per month in dollars, such as 0.30." };
    const problem = fullQuoteProblem(users, perMemberCents);
    if (problem) return { ok: false, error: problem };
    if (!note) return { ok: false, error: "Give a reason or note for this price; it is kept in the Logs." };
    return { ok: true, action: { kind: "send_invoice", users: users as number, perMemberCents, note } };
  }
  if (b.action === "cancel_invoice") {
    if (!note) return { ok: false, error: "Give a reason for cancelling the invoice." };
    return { ok: true, action: { kind: "cancel_invoice", note } };
  }
  if (b.action === "close") {
    if (!note) return { ok: false, error: "Give a reason for closing this request." };
    return { ok: true, action: { kind: "close", note } };
  }
  return { ok: false, error: "Choose what to do with this request." };
}
