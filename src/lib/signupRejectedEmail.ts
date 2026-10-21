// The email a customer gets when their signup is rejected (owner, 2026-10-21; wording approved by the owner as drafted). Pure on purpose
// (no database), so it is easy to test. It is a real refusal and says so, but it reads as automatic: it never says a person approved,
// checked or reviewed anything (the test next to this file scans it). The staff's private reason is NEVER in it: only the optional
// message the admin wrote for the customer is, as typed.

import type { OutgoingEmail } from "@/lib/email";

const CONTACT = "hello@squadino.com";
export const CUSTOMER_MESSAGE_MAX = 1000;

export interface SignupRejectedInput {
  clubName: string;
  contactName: string;
  /** What the admin chose to tell the customer (a refund, a cancelled card, why). Optional. */
  message?: string | null;
}

// Its own copy, so the file has no ties to the mail sender.
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "Naween Malwatta" -> "Naween". Anything that doesn't look like a name falls back to a plain "Hello".
function firstName(full: string): string | null {
  const first = full.trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 60) : null;
}

export function signupRejectedEmail(input: SignupRejectedInput): OutgoingEmail {
  const { clubName } = input;
  const first = firstName(input.contactName);
  const hello = first ? `Hi ${first},` : "Hello,";
  const thanks = `Thanks for your interest in SQUADINO for ${clubName}.`;
  const refusal = "Unfortunately we aren't able to set up an account for you.";
  const message = input.message?.trim() || null;
  const closing = `If you'd like to talk it through, reply to this email or write to ${CONTACT}.`;

  const messageHtml = message
    ? message.split(/\n{2,}/).map((p) => `<p style="color:#475569;line-height:1.5">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`).join("\n        ")
    : "";

  return {
    to: "", // filled in by the caller
    replyTo: CONTACT,
    subject: `Your SQUADINO signup for ${clubName}`,
    text: [hello, "", thanks, "", refusal, ...(message ? ["", message] : []), "", closing].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">About your SQUADINO signup</h2>
        <p style="color:#475569;line-height:1.5">${first ? `Hi ${escapeHtml(first)},` : "Hello,"}</p>
        <p style="color:#475569;line-height:1.5">Thanks for your interest in SQUADINO for <strong>${escapeHtml(clubName)}</strong>.</p>
        <p style="color:#475569;line-height:1.5">${escapeHtml(refusal)}</p>
        ${messageHtml}
        <p style="color:#64748b;font-size:13px;line-height:1.5">If you'd like to talk it through, reply to this email or write to <a href="mailto:${CONTACT}" style="color:#2563eb">${CONTACT}</a>.</p>
      </div>`,
  };
}
