// The email a club's admins get when they are given free days to make up for time Squadino was unavailable. Pure on purpose (no
// database), so it is easy to test, and the ops screen uses the same builder for its preview, so staff see exactly what goes out.
// Kept identical in the club app and ops (src/lib/freeDaysEmail.ts): change both together.
//
// Owner's wording rule (2026-10-18): a customer reads this as automatic. It never says a person approved or checked anything; the
// customerWording test scans it. The reason, the fix and the extra note are the admin's own words; everything else is fixed here.

import type { OutgoingEmail } from "@/lib/email";
import { daysWord, describeFreeDates } from "@/lib/freeDays";

const CONTACT = "hello@squadino.com";

// Its own copy, so the ops screen can build this email in the browser for its preview without pulling in the mail sender.
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// What the free days did for THIS club, which decides the sentence about money.
export type FreeDaysEffect = "STRIPE" | "TRIAL" | "NONE";

export interface FreeDaysEmailInput {
  clubName: string;
  /** The admin's first name when we have it. */
  recipientName?: string | null;
  title: string;
  whatHappened: string;
  whatWeAreDoing: string;
  extraNote?: string | null;
  /** The free days, YYYY-MM-DD. */
  dates: string[];
  effect: FreeDaysEffect;
  /** Long dates already formatted for the reader (e.g. "14 November 2026"): the payment, or trial end, before and after. */
  oldDateText?: string | null;
  newDateText?: string | null;
}

function firstName(full: string | null | undefined): string | null {
  const first = (full ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 60) : null;
}

/** The sentence that says what the free days do to this club's payments. */
export function effectSentence(input: Pick<FreeDaysEmailInput, "effect" | "oldDateText" | "newDateText">): string {
  const { effect, oldDateText, newDateText } = input;
  if (effect === "STRIPE" && newDateText) {
    return oldDateText
      ? `Your next payment has moved from ${oldDateText} to ${newDateText}. Nothing is charged for these days, and you don't need to do anything.`
      : `Your next payment now falls on ${newDateText}. Nothing is charged for these days, and you don't need to do anything.`;
  }
  if (effect === "TRIAL" && newDateText) {
    return oldDateText
      ? `Your free trial now ends on ${newDateText} instead of ${oldDateText}, and you don't need to do anything.`
      : `Your free trial now ends on ${newDateText}, and you don't need to do anything.`;
  }
  return "You don't have a payment coming up, so there is nothing to move. The free days are recorded on your account, and you don't need to do anything.";
}

// The admin's text, kept as they wrote it: blank lines make paragraphs, single line breaks stay line breaks.
function paragraphsHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="color:#475569;line-height:1.5;margin:0 0 10px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n        ");
}

export function freeDaysEmail(input: FreeDaysEmailInput): OutgoingEmail {
  const { clubName, title, whatHappened, whatWeAreDoing, dates } = input;
  const first = firstName(input.recipientName);
  const hello = first ? `Hi ${first},` : "Hello,";
  const dayCount = new Set(dates).size;
  const when = describeFreeDates(dates);
  const gift = `We're giving ${clubName} ${daysWord(dayCount)} of SQUADINO free of charge: ${when}.`;
  const effect = effectSentence(input);
  const extra = input.extraNote?.trim() || null;
  const sorry = "We're sorry for the disruption, and thank you for your patience.";
  const questions = `Questions? Reply to this email or write to ${CONTACT}.`;

  return {
    to: "", // filled in by the caller
    replyTo: CONTACT,
    subject: `${title}: free days for ${clubName}`,
    text: [
      hello,
      "",
      `${title}.`,
      "",
      "What happened",
      whatHappened,
      "",
      "What we're doing about it",
      whatWeAreDoing,
      "",
      "How we're making it up to you",
      gift,
      effect,
      ...(extra ? ["", extra] : []),
      "",
      sorry,
      "",
      questions,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
        <p style="color:#475569;line-height:1.5">${first ? `Hi ${escapeHtml(first)},` : "Hello,"}</p>
        <p style="color:#0f172a;font-weight:600;margin:20px 0 4px">What happened</p>
        ${paragraphsHtml(whatHappened)}
        <p style="color:#0f172a;font-weight:600;margin:20px 0 4px">What we're doing about it</p>
        ${paragraphsHtml(whatWeAreDoing)}
        <p style="color:#0f172a;font-weight:600;margin:20px 0 4px">How we're making it up to you</p>
        <p style="color:#475569;line-height:1.5;margin:0 0 10px">We're giving <strong>${escapeHtml(clubName)}</strong> <strong>${escapeHtml(daysWord(dayCount))}</strong> of SQUADINO free of charge: <strong>${escapeHtml(when)}</strong>.</p>
        <p style="color:#475569;line-height:1.5;margin:0 0 10px">${escapeHtml(effect)}</p>
        ${extra ? paragraphsHtml(extra) : ""}
        <p style="color:#475569;line-height:1.5;margin-top:20px">${escapeHtml(sorry)}</p>
        <p style="color:#64748b;font-size:13px;line-height:1.5">Questions? Reply to this email or write to <a href="mailto:${CONTACT}" style="color:#2563eb">${CONTACT}</a>.</p>
      </div>`,
  };
}
