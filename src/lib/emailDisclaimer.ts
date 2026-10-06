// Added to every email SQUADINO sends, by sendEmail, so no individual email template has to remember it.
// The same file is copied into Website/ and the ops app: keep the wording identical in all three.

export const EMAIL_DISCLAIMER =
  "This email is intended only for the person it was sent to and may contain confidential information. " +
  "If it reached you by mistake, please delete it and let us know at hello@squadino.com. " +
  "SQUADINO will never ask you for your password or card details by email.";

export function withDisclaimer<T extends { text: string; html?: string }>(msg: T): T {
  return {
    ...msg,
    text: `${msg.text}\n\n--\n${EMAIL_DISCLAIMER}`,
    ...(msg.html
      ? { html: `${msg.html}<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.5">${EMAIL_DISCLAIMER}</p>` }
      : {}),
  };
}
