// Emails the app tried to send and could not (the club app writes an "email.failed" line into the Logs each time; see its
// staffNotify.server.ts). The ops dashboard lists the recent ones for the people who can read the Logs, so a mail problem is noticed
// instead of found out later by someone who never got an email. Pure parts here, the database read in emailProblems.server.ts.

/** How far back the dashboard looks. */
export const EMAIL_PROBLEM_DAYS = 7;
/** How many it lists (the Logs hold the rest). */
export const EMAIL_PROBLEMS_SHOWN = 10;

const DAY_MS = 86_400_000;

export function emailProblemsSince(now: Date): Date {
  return new Date(now.getTime() - EMAIL_PROBLEM_DAYS * DAY_MS);
}

export interface EmailProblem {
  id: string;
  at: Date;
  /** The club or request the email was about. */
  label: string;
  /** Where to look at it, when there is a page for it. */
  href: string | null;
  /** What the app wrote: which email, who it could not reach and the provider's reason. */
  note: string;
}

/** A page for the thing the email was about: a club has one; a Full package request is on the dashboard instead. */
export function emailProblemHref(targetType: string, targetId: string | null): string | null {
  if (!targetId) return null;
  if (targetType === "club") return `/clubs/${targetId}`;
  if (targetType === "signup") return `/signups/${targetId}`;
  return null;
}
