import { describe, it, expect } from "vitest";
import {
  BEAT_GRACE_MS, HEARTBEAT_MS, IDLE_LIMIT_MS, KEEP_OUT_MS, blockedText, endReasonText, holderLabel, isKeptOut, isLockLive, isLockRenewable,
  keepOutMinutesLeft, lockedErrorText, needsExclusiveAccess, removedText, roleWords, sinceWords, type Holder,
} from "./clubAccess";

const priya: Holder = { staffId: "u1", name: "Priya Shah", role: "CUSTOMER_CARE", minutes: 12 };

describe("who is held to one person per club", () => {
  it("lets super admins and admins in always", () => {
    expect(needsExclusiveAccess("SUPER_ADMIN")).toBe(false);
    expect(needsExclusiveAccess("ADMIN")).toBe(false);
  });

  it("holds customer care and moderators to it (owner's decision)", () => {
    expect(needsExclusiveAccess("CUSTOMER_CARE")).toBe(true);
    expect(needsExclusiveAccess("MODERATOR")).toBe(true);
  });

  it("holds a role it doesn't know, or no role, to it (the safer side)", () => {
    expect(needsExclusiveAccess("SOMETHING_NEW")).toBe(true);
    expect(needsExclusiveAccess("admin")).toBe(true); // roles are exact; a lower-case one is not an admin
    expect(needsExclusiveAccess("")).toBe(true);
    expect(needsExclusiveAccess(null)).toBe(true);
    expect(needsExclusiveAccess(undefined)).toBe(true);
  });
});

describe("when a hold is still alive", () => {
  it("uses the owner's numbers: 30 minutes of nothing frees it, a silent page frees it after 3 minutes", () => {
    expect(IDLE_LIMIT_MS).toBe(30 * 60_000);
    expect(BEAT_GRACE_MS).toBe(3 * 60_000);
    // A page must report in several times before it is given up on.
    expect(BEAT_GRACE_MS / HEARTBEAT_MS).toBeGreaterThanOrEqual(4);
  });

  it("is alive while the page reports in and the person is active", () => {
    expect(isLockLive({ beatAgeMs: 0, activeAgeMs: 0, endedAgeMs: null })).toBe(true);
    expect(isLockLive({ beatAgeMs: HEARTBEAT_MS, activeAgeMs: 10 * 60_000, endedAgeMs: null })).toBe(true);
  });

  it("is freed when the page stops reporting in", () => {
    expect(isLockLive({ beatAgeMs: BEAT_GRACE_MS, activeAgeMs: 0, endedAgeMs: null })).toBe(true);
    expect(isLockLive({ beatAgeMs: BEAT_GRACE_MS + 1, activeAgeMs: 0, endedAgeMs: null })).toBe(false);
  });

  it("is freed after 30 minutes with no activity even though the page is open", () => {
    expect(isLockLive({ beatAgeMs: 0, activeAgeMs: IDLE_LIMIT_MS, endedAgeMs: null })).toBe(true);
    expect(isLockLive({ beatAgeMs: 0, activeAgeMs: IDLE_LIMIT_MS + 1, endedAgeMs: null })).toBe(false);
  });

  it("can be renewed by its own person after a quiet spell, but not after the idle limit", () => {
    // A laptop that slept: the page was silent for ten minutes, nobody else came in, so the person carries on.
    expect(isLockRenewable({ beatAgeMs: 10 * 60_000, activeAgeMs: 10 * 60_000, endedAgeMs: null })).toBe(true);
    expect(isLockRenewable({ beatAgeMs: 0, activeAgeMs: IDLE_LIMIT_MS + 1, endedAgeMs: null })).toBe(false);
  });
});

describe("an admin taking a club over", () => {
  it("ends the hold at once, even though the page is still reporting in and active", () => {
    expect(isLockLive({ beatAgeMs: 1000, activeAgeMs: 1000, endedAgeMs: 5000 })).toBe(false);
    expect(isLockRenewable({ beatAgeMs: 1000, activeAgeMs: 1000, endedAgeMs: 5000 })).toBe(false);
  });

  it("keeps the person put out from taking it straight back, for 30 minutes", () => {
    expect(KEEP_OUT_MS).toBe(30 * 60_000);
    expect(isKeptOut(null)).toBe(false);
    expect(isKeptOut(0)).toBe(true);
    expect(isKeptOut(KEEP_OUT_MS - 1)).toBe(true);
    expect(isKeptOut(KEEP_OUT_MS)).toBe(false);
  });

  it("counts the minutes left, never showing 0 while still kept out", () => {
    expect(keepOutMinutesLeft(0)).toBe(30);
    expect(keepOutMinutesLeft(60_000)).toBe(29);
    expect(keepOutMinutesLeft(KEEP_OUT_MS - 1)).toBe(1);
  });

  it("tells them who, and when they can try again", () => {
    expect(removedText("Alex Admin", 28)).toBe("An admin (Alex Admin) took over this account and ended your access. You can open it again in 28 minutes, or sooner if an admin lets you in.");
    expect(removedText("Alex Admin", 1)).toContain("in 1 minute,");
    expect(endReasonText({ kind: "removed", by: "Alex Admin", minutesLeft: 30 })).toContain("took over this account");
  });
});

describe("the words on screen", () => {
  it("names the role in plain words", () => {
    expect(roleWords("CUSTOMER_CARE")).toBe("customer care officer");
    expect(roleWords("MODERATOR")).toBe("moderator");
    expect(roleWords("ADMIN")).toBe("admin");
    expect(roleWords("SUPER_ADMIN")).toBe("super admin");
    expect(roleWords("NEW_ROLE")).toBe("new role");
  });

  it("says who is in", () => {
    expect(holderLabel(priya)).toBe("Priya Shah (customer care officer)");
  });

  it("says how long in minutes and hours", () => {
    expect(sinceWords(0)).toBe("just now");
    expect(sinceWords(1)).toBe("for 1 minute");
    expect(sinceWords(12)).toBe("for 12 minutes");
    expect(sinceWords(60)).toBe("for 1 hour");
    expect(sinceWords(65)).toBe("for 1 hour 5 minutes");
    expect(sinceWords(135)).toBe("for 2 hours 15 minutes");
  });

  it("tells a blocked person who is in and for how long", () => {
    expect(blockedText(priya)).toBe("Priya Shah (customer care officer) has had this account open for 12 minutes.");
    expect(blockedText({ ...priya, minutes: 0 })).toBe("Priya Shah (customer care officer) has just opened this account.");
  });

  it("says why a hold ended", () => {
    expect(endReasonText({ kind: "idle" })).toContain("more than 30 minutes");
    expect(endReasonText({ kind: "taken", holder: priya })).toBe("Priya Shah (customer care officer) has this account open now.");
    expect(endReasonText({ kind: "ended" })).toContain("closed it in another window");
  });

  it("gives the locked answer for the screens that change the account", () => {
    expect(lockedErrorText({ kind: "blocked", holder: priya })).toContain("Only one customer care officer or moderator can work on an account at a time.");
    expect(lockedErrorText({ kind: "idle" })).toContain("Reload the page to open it again.");
  });
});
