// One person per club account (owner, 2026-10-23): a customer care officer or a moderator can have a club's page open and make changes
// to it only while nobody else of those two roles has it open. Super admins and admins are never held back and never hold a club, so
// they can always open any account; an admin who finds an officer inside can "take over", which ends the officer's access at once.
// This file is the pure part (who is held to the rule, when a hold is still alive, the words used on screen). No database, so all of it
// is unit-tested. The database part is clubAccess.server.ts.

/** How often an open page tells the server "still here" (and whether the person has touched the page since the last time). */
export const HEARTBEAT_MS = 30_000;
/** A hold whose page has said nothing for this long is treated as gone (closed browser, lost connection, crashed tab). */
export const BEAT_GRACE_MS = 3 * 60_000;
/** A hold whose person has done nothing for this long is freed, even if the page is still open (owner: 30 minutes). */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** How often a waiting screen or an admin's panel looks again at who is in. */
export const WATCH_MS = 15_000;
/**
 * After an admin takes a club over, the person put out can't take it straight back for this long (or until somebody else opens it).
 * Without this, the officer's screen refreshing itself would quietly reopen the club a moment after the admin ended the access.
 */
export const KEEP_OUT_MS = 30 * 60_000;

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

/**
 * Everyone except admins is held to one-person-per-club. A role the code doesn't know is held too: the safer side of the rule.
 */
export function needsExclusiveAccess(role: string | null | undefined): boolean {
  return !(typeof role === "string" && ADMIN_ROLES.has(role));
}

const ROLE_WORDS: Record<string, string> = {
  SUPER_ADMIN: "super admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
  CUSTOMER_CARE: "customer care officer",
};

/** The role in plain lower-case words, for use in a sentence ("a customer care officer"). */
export function roleWords(role: string): string {
  return ROLE_WORDS[role] ?? role.toLowerCase().replace(/_/g, " ");
}

/** How old each sign of life of a hold is, in milliseconds (counted by the database's own clock, so servers can't disagree). */
export interface LockAges {
  beatAgeMs: number;
  activeAgeMs: number;
  /** How long ago an admin took the club over from this person; null if that never happened to this row. */
  endedAgeMs: number | null;
}

/** A hold is alive while its page is still reporting in AND its person has been active recently, and no admin has ended it. */
export function isLockLive(ages: LockAges): boolean {
  return ages.endedAgeMs === null && ages.beatAgeMs <= BEAT_GRACE_MS && ages.activeAgeMs <= IDLE_LIMIT_MS;
}

/** Whether the person an admin put out is still being kept out (the row is theirs and the keep-out time hasn't run down). */
export function isKeptOut(endedAgeMs: number | null): boolean {
  return endedAgeMs !== null && endedAgeMs < KEEP_OUT_MS;
}

/** Whole minutes still to wait, rounded up so it never says "0 minutes" while still kept out. */
export function keepOutMinutesLeft(endedAgeMs: number): number {
  return Math.max(1, Math.ceil((KEEP_OUT_MS - endedAgeMs) / 60_000));
}

/** A hold that may still be renewed by its own person: they may have been away from the keyboard, but not past the idle limit. */
export function isLockRenewable(ages: LockAges): boolean {
  return ages.endedAgeMs === null && ages.activeAgeMs <= IDLE_LIMIT_MS;
}

/** A person who holds, or held, a club account, as shown on screen. */
export interface Holder {
  staffId: string;
  name: string;
  role: string;
  /** How long they have had it open, in whole minutes (0 = just now). */
  minutes: number;
}

/** "Priya Shah (customer care officer)". */
export function holderLabel(h: Pick<Holder, "name" | "role">): string {
  return `${h.name} (${roleWords(h.role)})`;
}

/** "just now", "for 1 minute", "for 12 minutes", "for 1 hour 5 minutes". */
export function sinceWords(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `for ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = `${h} hour${h === 1 ? "" : "s"}`;
  return m === 0 ? `for ${hours}` : `for ${hours} ${m} minute${m === 1 ? "" : "s"}`;
}

/** Why a person's hold on a club has ended, when their page finds out. */
export type EndReason =
  | { kind: "idle" } // they were away for more than the idle limit
  | { kind: "taken"; holder: Holder } // someone else has it now
  | { kind: "removed"; by: string; minutesLeft: number } // an admin took the club over from them
  | { kind: "ended" }; // the hold is simply gone (for example it was closed from another window)

export function endReasonText(reason: EndReason): string {
  switch (reason.kind) {
    case "idle":
      return `You were away from this account for more than ${IDLE_LIMIT_MS / 60_000} minutes, so it was freed for others.`;
    case "taken":
      return `${holderLabel(reason.holder)} has this account open now.`;
    case "removed":
      return removedText(reason.by, reason.minutesLeft);
    default:
      return "Your access to this account has ended. You may have closed it in another window.";
  }
}

/** What the person an admin put out is told. */
export function removedText(by: string, minutesLeft: number): string {
  return `An admin (${by}) took over this account and ended your access. You can open it again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}, or sooner if an admin lets you in.`;
}

/** The line shown to a blocked person, and in the answer an API gives them. */
export function blockedText(holder: Holder): string {
  const since = sinceWords(holder.minutes);
  return since === "just now"
    ? `${holderLabel(holder)} has just opened this account.`
    : `${holderLabel(holder)} has had this account open ${since}.`;
}

/** The answer when a signed-in officer without the hold tries to change the club (HTTP 423, "locked"). */
export function lockedErrorText(reason: EndReason | { kind: "blocked"; holder: Holder }): string {
  if (reason.kind === "blocked") return `${blockedText(reason.holder)} Only one customer care officer or moderator can work on an account at a time.`;
  return `${endReasonText(reason)} Reload the page to open it again.`;
}
