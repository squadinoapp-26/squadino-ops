import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/auditLog.server";
import { isMissingTable } from "@/lib/prismaErrors";
import {
  BEAT_GRACE_MS, IDLE_LIMIT_MS, KEEP_OUT_MS, holderLabel, isKeptOut, isLockLive, keepOutMinutesLeft, lockedErrorText,
  needsExclusiveAccess, sinceWords, type EndReason, type Holder,
} from "@/lib/clubAccess";

// The database part of "one person per club account" (rules and words: clubAccess.ts). One row per club in club_access_locks while a
// customer care officer or moderator has it open. Every time is read from the DATABASE's own clock (never a server's), because the
// console runs on many servers at once whose clocks can differ by seconds.
//
// Before the database update that creates the table has been run, nothing here can work, so every function says "off" and the console
// lets everyone in (admins are told on the club page). It must not break the console that way round.
//
// (A raw query can't take a piece of SQL as a parameter, so "now as the database stores dates" is written out in each query:
// timezone('UTC', now()).)

type Staff = { id: string; name: string; role: string };

/** The table isn't there yet (the database update hasn't been run). Raw queries report that differently from Prisma's own calls. */
export function isLockTableMissing(e: unknown): boolean {
  if (isMissingTable(e)) return true;
  const err = e as { code?: string; message?: string; meta?: { code?: string; message?: string }; cause?: { message?: string; code?: string } };
  if (err?.code === "42P01" || err?.meta?.code === "42P01" || err?.cause?.code === "42P01") return true;
  const text = [err?.message, err?.meta?.message, err?.cause?.message].filter(Boolean).join(" ");
  return /club_access_locks/.test(text) && /does not exist/i.test(text);
}

interface LockRow {
  staffId: string;
  staffName: string;
  staffRole: string;
  viewId: string;
  endedByName: string | null;
  sinceMs: number;
  beatAgeMs: number;
  activeAgeMs: number;
  endedAgeMs: number | null;
}

function holderOf(row: Pick<LockRow, "staffId" | "staffName" | "staffRole" | "sinceMs">): Holder {
  return { staffId: row.staffId, name: row.staffName, role: row.staffRole, minutes: Math.max(0, Math.floor(row.sinceMs / 60_000)) };
}

async function readRow(clubId: string): Promise<LockRow | null> {
  const rows = await prisma.$queryRaw<LockRow[]>`
    SELECT "staffId", "staffName", "staffRole", "viewId", "endedByName",
      (EXTRACT(EPOCH FROM (timezone('UTC', now()) - "acquiredAt")) * 1000)::double precision AS "sinceMs",
      (EXTRACT(EPOCH FROM (timezone('UTC', now()) - "lastBeatAt")) * 1000)::double precision AS "beatAgeMs",
      (EXTRACT(EPOCH FROM (timezone('UTC', now()) - "lastActiveAt")) * 1000)::double precision AS "activeAgeMs",
      (EXTRACT(EPOCH FROM (timezone('UTC', now()) - "endedAt")) * 1000)::double precision AS "endedAgeMs"
    FROM club_access_locks WHERE "clubId" = ${clubId}`;
  return rows[0] ?? null;
}

/** Who has the club open right now (null = nobody), and whether account locking is switched on at all. */
export async function readLiveHolder(clubId: string): Promise<{ enabled: boolean; holder: Holder | null }> {
  try {
    const row = await readRow(clubId);
    return { enabled: true, holder: row && isLockLive(row) ? holderOf(row) : null };
  } catch (e) {
    if (isLockTableMissing(e)) return { enabled: false, holder: null };
    throw e;
  }
}

export type AccessState =
  | { state: "off" } // locking isn't switched on yet: let them in
  | { state: "mine"; viewId: string } // they have it (a new page marker comes with it)
  | { state: "blocked"; holder: Holder } // somebody else has it
  | { state: "removed"; by: string; minutesLeft: number }; // an admin took it from them a little while ago

/**
 * Takes the club for a customer care officer or moderator, if it is free, expired, or already theirs. ONE statement does the checking and
 * the taking, so two people opening the same club in the same instant cannot both get it: the database lets exactly one through.
 * Opening it again yourself (a reload, the page refreshing itself) keeps your hold and your "last active" time; the page's own
 * heartbeat is what records activity. A row an admin ended (endedAt) holds nothing for anyone else, but keeps its own person out for
 * KEEP_OUT_MS, so their page refreshing itself can't quietly take the club straight back.
 */
export async function acquireClubAccess(staff: Staff, clubId: string, attempt = 1): Promise<AccessState> {
  const viewId = randomUUID();
  const graceSecs = BEAT_GRACE_MS / 1000;
  const idleSecs = IDLE_LIMIT_MS / 1000;
  const keepOutSecs = KEEP_OUT_MS / 1000;
  try {
    const won = await prisma.$queryRaw<{ clubId: string }[]>`
      INSERT INTO club_access_locks AS l ("clubId", "staffId", "staffName", "staffRole", "viewId", "acquiredAt", "lastBeatAt", "lastActiveAt")
      VALUES (${clubId}, ${staff.id}, ${staff.name}, ${staff.role}, ${viewId}, timezone('UTC', now()), timezone('UTC', now()), timezone('UTC', now()))
      ON CONFLICT ("clubId") DO UPDATE SET
        "staffId" = EXCLUDED."staffId",
        "staffName" = EXCLUDED."staffName",
        "staffRole" = EXCLUDED."staffRole",
        "viewId" = EXCLUDED."viewId",
        "acquiredAt" = CASE WHEN l."endedAt" IS NULL AND l."staffId" = EXCLUDED."staffId" AND l."lastActiveAt" >= EXCLUDED."lastActiveAt" - make_interval(secs => ${idleSecs}::double precision)
          THEN l."acquiredAt" ELSE EXCLUDED."acquiredAt" END,
        "lastBeatAt" = EXCLUDED."lastBeatAt",
        "lastActiveAt" = CASE WHEN l."endedAt" IS NULL AND l."staffId" = EXCLUDED."staffId" AND l."lastActiveAt" >= EXCLUDED."lastActiveAt" - make_interval(secs => ${idleSecs}::double precision)
          THEN l."lastActiveAt" ELSE EXCLUDED."lastActiveAt" END,
        "endedAt" = NULL,
        "endedByName" = NULL
      WHERE CASE WHEN l."endedAt" IS NOT NULL
          THEN (l."staffId" <> EXCLUDED."staffId" OR l."endedAt" < EXCLUDED."lastBeatAt" - make_interval(secs => ${keepOutSecs}::double precision))
          ELSE (l."staffId" = EXCLUDED."staffId"
            OR l."lastBeatAt" < EXCLUDED."lastBeatAt" - make_interval(secs => ${graceSecs}::double precision)
            OR l."lastActiveAt" < EXCLUDED."lastActiveAt" - make_interval(secs => ${idleSecs}::double precision))
        END
      RETURNING l."clubId"`;
    if (won.length === 1) return { state: "mine", viewId };
    const row = await readRow(clubId);
    if (row && row.staffId === staff.id && isKeptOut(row.endedAgeMs)) {
      return { state: "removed", by: row.endedByName ?? "an admin", minutesLeft: keepOutMinutesLeft(row.endedAgeMs!) };
    }
    // Gone again between the two statements (they left that very moment): ask once more instead of guessing.
    if (!row || !isLockLive(row)) {
      if (attempt >= 3) throw new Error("Couldn't settle who has the club account open; try again.");
      return acquireClubAccess(staff, clubId, attempt + 1);
    }
    return { state: "blocked", holder: holderOf(row) };
  } catch (e) {
    if (isLockTableMissing(e)) return { state: "off" };
    throw e;
  }
}

export type HeartbeatResult = { ok: true } | { ok: false; reason: EndReason };

/**
 * "Still here" from an open page (every 30 seconds). Renews the hold if it is still theirs and they haven't been away past the idle limit.
 * `active` says whether they touched the page since the last beat; only that moves the idle clock. It never takes a club someone else
 * now holds, and never brings back a hold an admin ended, so a take-over sticks.
 */
export async function heartbeatClubAccess(staff: Staff, clubId: string, active: boolean): Promise<HeartbeatResult> {
  const idleSecs = IDLE_LIMIT_MS / 1000;
  try {
    const renewed = await prisma.$queryRaw<{ clubId: string }[]>`
      UPDATE club_access_locks SET
        "lastBeatAt" = timezone('UTC', now()),
        "lastActiveAt" = CASE WHEN ${active}::boolean THEN timezone('UTC', now()) ELSE "lastActiveAt" END
      WHERE "clubId" = ${clubId} AND "staffId" = ${staff.id} AND "endedAt" IS NULL
        AND "lastActiveAt" >= timezone('UTC', now()) - make_interval(secs => ${idleSecs}::double precision)
      RETURNING "clubId"`;
    if (renewed.length === 1) return { ok: true };
    const row = await readRow(clubId);
    if (!row) return { ok: false, reason: { kind: "ended" } };
    if (row.staffId === staff.id) {
      if (row.endedAgeMs !== null) {
        return {
          ok: false,
          reason: isKeptOut(row.endedAgeMs)
            ? { kind: "removed", by: row.endedByName ?? "an admin", minutesLeft: keepOutMinutesLeft(row.endedAgeMs) }
            : { kind: "ended" },
        };
      }
      return { ok: false, reason: { kind: "idle" } };
    }
    return { ok: false, reason: isLockLive(row) ? { kind: "taken", holder: holderOf(row) } : { kind: "ended" } };
  } catch (e) {
    if (isLockTableMissing(e)) return { ok: true };
    throw e;
  }
}

/** The page is closing: free the hold, but only if this page is still the latest one (see viewId in the schema). */
export async function releaseClubAccess(staff: Staff, clubId: string, viewId: string): Promise<void> {
  if (!viewId) return;
  try {
    // A row an admin ended is left alone: it is the note that keeps this person out, not a hold to give up.
    await prisma.clubAccessLock.deleteMany({ where: { clubId, staffId: staff.id, viewId, endedAt: null } });
  } catch (e) {
    if (!isLockTableMissing(e)) throw e;
  }
}

/**
 * An admin ends whoever's access is live. The officer's page finds out within seconds, their changes are refused from this moment, and
 * for KEEP_OUT_MS they can't open the club again (so the page refreshing itself can't undo it). Written to the Logs with who took over
 * from whom. One statement ends it and tells us who it was, so it also can't hit someone who has just left.
 */
export async function takeOverClubAccess(admin: Staff, club: { id: string; name: string }): Promise<{ tookFrom: Holder | null }> {
  const graceSecs = BEAT_GRACE_MS / 1000;
  const idleSecs = IDLE_LIMIT_MS / 1000;
  try {
    const ended = await prisma.$queryRaw<Pick<LockRow, "staffId" | "staffName" | "staffRole" | "sinceMs">[]>`
      UPDATE club_access_locks SET "endedAt" = timezone('UTC', now()), "endedByName" = ${admin.name}
      WHERE "clubId" = ${club.id} AND "endedAt" IS NULL
        AND "lastBeatAt" >= timezone('UTC', now()) - make_interval(secs => ${graceSecs}::double precision)
        AND "lastActiveAt" >= timezone('UTC', now()) - make_interval(secs => ${idleSecs}::double precision)
      RETURNING "staffId", "staffName", "staffRole",
        (EXTRACT(EPOCH FROM (timezone('UTC', now()) - "acquiredAt")) * 1000)::double precision AS "sinceMs"`;
    if (ended.length === 0) return { tookFrom: null };
    const holder = holderOf(ended[0]);
    await recordAudit(admin, {
      action: "club.access_taken_over",
      targetType: "club",
      targetId: club.id,
      targetLabel: club.name,
      note: `Took over from ${holderLabel(holder)}, who ${holder.minutes < 1 ? "had only just opened the account" : `had had the account open ${sinceWords(holder.minutes)}`}`,
    });
    return { tookFrom: holder };
  } catch (e) {
    if (isLockTableMissing(e)) return { tookFrom: null };
    throw e;
  }
}

/**
 * The second lock, on the server: every change made from a club's page asks this first. An admin always passes. A customer care officer
 * or moderator passes only while the hold is theirs (and the change counts as activity); otherwise the answer is 423 "locked" with
 * the reason, so hiding the page's buttons is never the only protection. Returns null to carry on, or the response to send back.
 */
export async function assertClubAccess(staff: Staff, clubId: string): Promise<NextResponse | null> {
  if (!needsExclusiveAccess(staff.role)) return null;
  const result = await heartbeatClubAccess(staff, clubId, true);
  if (result.ok) return null;
  return NextResponse.json({ error: lockedErrorText(result.reason), locked: true }, { status: 423 });
}
