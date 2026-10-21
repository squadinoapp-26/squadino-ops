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

import { withDisclaimer } from "@/lib/emailDisclaimer";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // When set, replies go here instead of MAIL_FROM (same as the club app's email.ts).
  replyTo?: string;
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

export async function sendEmail(original: OutgoingEmail): Promise<SendResult> {
  const msg = withDisclaimer(original);
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
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
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

/** Base URL for links into the main squadino app (not ops itself) — e.g. the
 * set-password link sent to a newly-provisioned club's owner. Defaults to the
 * shell host (see squadino's src/lib/hostClub.ts) so this works out of the
 * box against production without extra config. */
export function squadinoAppUrl(): string {
  return (process.env.SQUADINO_APP_URL || "https://app.squadino.com").replace(/\/$/, "");
}

/**
 * The setup email a platform admin sends a new club's owner once the club
 * is approved (see sendOwnerSetupEmails in src/lib/clubSetupEmails.ts), and
 * the second email the "we've received your signup" email promises. Three
 * steps: a one-time "set your password" link, where and how to sign in, and a
 * few quick tips for setting the club up (the same steps as the "Get your club
 * set up" checklist on the owner's dashboard). `links`, when given, adds the
 * sign-in address, the owner's email and the link members use to join.
 * Kept identical in the club app and ops: change both together.
 */
export function welcomeEmail(
  setPasswordUrl: string,
  clubName: string,
  ttlMinutes: number,
  links?: { signInUrl: string; inviteUrl: string; email?: string; coach?: boolean },
): OutgoingEmail {
  const safeName = escapeHtml(clubName);
  const coach = !!links?.coach;
  const org = coach ? "business" : "club";
  const signIn = links
    ? `Go to ${links.signInUrl} and sign in with ${links.email ?? "your email address"} and the password you just chose.`
    : "Go to the SQUADINO sign-in page and sign in with your email address and the password you just chose.";
  const tips = setupTips(coach, links?.inviteUrl);
  const checklist = `Your dashboard shows a "Get your ${coach ? "coaching" : "club"} set up" checklist that ticks itself off as you go. The quick version:`;
  const help = "Need a hand? Reply to this email or write to hello@squadino.com.";

  return {
    to: "", // filled in by the caller
    subject: `Welcome to SQUADINO — set up your ${clubName} account`,
    text: [
      `Your SQUADINO account for ${clubName} is ready.`,
      "",
      "STEP 1: Set your password",
      setPasswordUrl,
      `The link works once and expires in ${lifetimeWords(ttlMinutes)} — if it expires, use "Forgot password" on the sign-in page.`,
      "",
      "STEP 2: Sign in",
      signIn,
      "",
      `STEP 3: Set up your ${org}`,
      checklist,
      ...tips.map((t, i) => `${i + 1}. ${t.title}: ${t.text}`),
      "",
      help,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to SQUADINO</h2>
        <p style="color:#475569;line-height:1.5">
          Your account for <strong>${safeName}</strong> is ready. Three quick steps and you're in.
        </p>

        <p style="margin:24px 0 4px;font-weight:600">Step 1: Set your password</p>
        <p style="margin:12px 0">
          <a href="${escapeHtml(setPasswordUrl)}" style="background:#e31837;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;display:inline-block">
            Set your password
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0">
          The link works once and expires in ${lifetimeWords(ttlMinutes)} — if it expires, use "Forgot password" on the sign-in page.
        </p>

        <p style="margin:24px 0 4px;font-weight:600">Step 2: Sign in</p>
        <p style="color:#475569;line-height:1.5;margin:0">${links
          ? `Go to <a href="${escapeHtml(links.signInUrl)}" style="color:#2563eb">${escapeHtml(links.signInUrl)}</a> and sign in with <strong>${escapeHtml(links.email ?? "your email address")}</strong> and the password you just chose.`
          : "Go to the SQUADINO sign-in page and sign in with your email address and the password you just chose."}
        </p>

        <p style="margin:24px 0 4px;font-weight:600">Step 3: Set up your ${org}</p>
        <p style="color:#475569;line-height:1.5;margin:0 0 8px">${escapeHtml(checklist)}</p>
        <ol style="color:#475569;line-height:1.6;padding-left:20px;margin:0">
          ${tips.map((t) => `<li style="margin-bottom:8px"><strong>${escapeHtml(t.title)}.</strong> ${t.html}</li>`).join("\n          ")}
        </ol>

        <p style="color:#64748b;font-size:13px;line-height:1.5;margin-top:24px">
          Need a hand? Reply to this email or write to <a href="mailto:hello@squadino.com" style="color:#2563eb">hello@squadino.com</a>.
        </p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all;margin-top:20px">${escapeHtml(setPasswordUrl)}</p>
      </div>`,
  };
}

// The tips in the setup email, in the order of the dashboard checklist. `text` is the plain-text line and `html` the
// same words with the join link made clickable; the join link is left out when the caller doesn't have one.
function setupTips(coach: boolean, inviteUrl?: string): { title: string; text: string; html: string }[] {
  const tip = (title: string, text: string, html = escapeHtml(text)) => ({ title, text, html });
  const logo = tip("Add your logo", "Open Management, then App Settings. Your logo shows on your dashboard and across the app.");
  const joinText = (who: string, extra: string) =>
    `${inviteUrl ? `Share your join link, ${inviteUrl}, ` : "Share your join link (it's on your dashboard) "}with your ${who}. You approve each person before they get in.${extra}`;
  const joinHtml = (who: string, extra: string) =>
    `${inviteUrl ? `Share your join link, <a href="${escapeHtml(inviteUrl)}" style="color:#2563eb;word-break:break-all">${escapeHtml(inviteUrl)}</a>, ` : "Share your join link (it's on your dashboard) "}with your ${who}. You approve each person before they get in.${escapeHtml(extra)}`;

  if (coach) {
    const invite = tip("Invite your clients", joinText("clients", ""), joinHtml("clients", ""));
    return [
      logo,
      tip("Put up your first session", "Open Bookings, add a private lesson or a small group, and set the places and price. Clients book in from there."),
      invite,
    ];
  }
  const extra = ' Already have a spreadsheet of members? Open Management, then Manage Users, then "Import from Excel / CSV". Imported members use "Forgot password" the first time they sign in.';
  return [
    logo,
    tip("Create your first team", "Open Teams and group your athletes into teams or squads, so you can message and roster them together."),
    tip("Schedule your first event", "Open Events and add a training session, game or meet. Members can RSVP straight away."),
    tip("Post a welcome on the Wall", "Say hello, so new members land on something friendly."),
    tip("Invite your members", joinText("members", extra), joinHtml("members", extra)),
  ];
}

// "1440" -> "24 hours", "60" -> "1 hour", "45" -> "45 minutes": what the owner reads, not the number we store.
function lifetimeWords(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

// Club names on this path come straight from a self-serve signup form, so
// escape them before they go into HTML.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Sent to a club's admins when a platform admin switches its own subdomain on. */
export function subdomainLiveEmail(clubName: string, clubUrl: string): OutgoingEmail {
  return {
    to: "", // filled in by the caller
    subject: `${clubName}'s own SQUADINO web address is live`,
    text: [
      `Good news: ${clubName} now has its own web address on SQUADINO.`,
      "",
      clubUrl,
      "",
      "Sign in there from now on, and share it with your members.",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Your web address is live</h2>
        <p style="color:#475569;line-height:1.5">
          <strong>${escapeHtml(clubName)}</strong> now has its own web address on SQUADINO. Sign in there from now on, and share it with your members.
        </p>
        <p style="margin:24px 0">
          <a href="${clubUrl}" style="background:#e31837;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;display:inline-block">
            Open ${escapeHtml(clubName)}
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all;margin-top:20px">${clubUrl}</p>
      </div>`,
  };
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
