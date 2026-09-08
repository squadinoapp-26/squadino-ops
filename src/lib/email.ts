/**
 * Outgoing email for the ops console (platform staff password resets).
 *
 * No mail provider is configured for this app yet, so the default transport
 * writes the message to the server log instead of sending it. That keeps the
 * forgot-password flow fully usable in development: the link appears in the
 * terminal running the dev server.
 *
 * Set MAIL_FROM and RESEND_API_KEY in .env and messages go out over HTTPS via
 * Resend — same provider/env vars as the main squadino app.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendResult {
  /** True only when a provider accepted the message for delivery. */
  delivered: boolean;
  /** Which transport handled it — "resend" or "console". */
  via: string;
  error?: string;
}

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
}

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  if (!mailConfigured()) {
    // Development fallback: surface the message so the flow can be completed
    // without a provider. Never silently swallow it.
    console.log(
      [
        "",
        "──────────────── EMAIL (not sent — no mail provider configured) ────────────────",
        `To:      ${msg.to}`,
        `Subject: ${msg.subject}`,
        "",
        msg.text,
        "────────────────────────────────────────────────────────────────────────────────",
        "Set MAIL_FROM and RESEND_API_KEY in .env to deliver this for real.",
        "",
      ].join("\n"),
    );
    return { delivered: false, via: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Email send failed (${res.status}): ${detail}`);
      return { delivered: false, via: "resend", error: `Provider returned ${res.status}` };
    }
    return { delivered: true, via: "resend" };
  } catch (e) {
    console.error("Email send threw:", e);
    return { delivered: false, via: "resend", error: e instanceof Error ? e.message : "send failed" };
  }
}

export function passwordResetEmail(resetUrl: string, ttlMinutes: number): OutgoingEmail {
  return {
    to: "", // filled in by the caller
    subject: "Reset your SQUADINO Ops password",
    text: [
      "We received a request to reset the password on your SQUADINO Ops account.",
      "",
      "Open this link to choose a new password:",
      resetUrl,
      "",
      `The link works once and expires in ${ttlMinutes} minutes.`,
      "",
      "If you didn't ask for this, you can ignore this email — your password won't change.",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Reset your Ops password</h2>
        <p style="color:#475569;line-height:1.5">
          We received a request to reset the password on your SQUADINO Ops account.
        </p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#1d4ed8;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;display:inline-block">
            Choose a new password
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.5">
          The link works once and expires in ${ttlMinutes} minutes.<br>
          If you didn't ask for this, you can ignore this email — your password won't change.
        </p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all;margin-top:20px">${resetUrl}</p>
      </div>`,
  };
}
