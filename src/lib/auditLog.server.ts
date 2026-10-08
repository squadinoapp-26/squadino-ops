import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  actionsMatching, escapeLike, isAuditAction, melbourneRange, parseDateInput, parseDayWord, searchWords, slugOfHost, urlHost,
  type AuditAction, type AuditChange, type AuditTargetType,
} from "@/lib/auditLog";
import { ROOT_DOMAIN } from "@/lib/hostClub";

type Actor = { id: string; name: string; role: string } | null;

export interface AuditEntry {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetLabel: string;
  changes?: AuditChange[];
  note?: string | null;
}

/**
 * Stamps one change into the platform Logs. Insert-only: there's no update
 * or delete anywhere in the app, so what's written here stays as written.
 *
 * An edit that changed nothing (an empty `changes` list) isn't logged.
 * Logging never blocks the change itself — if the table isn't there yet
 * (code deployed before `db-sync.cmd` ran) the entry is dropped with a
 * server-log error instead of failing the admin's action.
 */
export async function recordAudit(actor: Actor, entry: AuditEntry): Promise<void> {
  if (entry.changes && entry.changes.length === 0) return;
  try {
    await prisma.platformAuditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "Unknown",
        actorRole: actor?.role ?? "UNKNOWN",
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        targetLabel: entry.targetLabel,
        changes: entry.changes ? (entry.changes as unknown as Prisma.InputJsonValue) : undefined,
        note: entry.note ?? null,
      },
    });
  } catch (e) {
    console.error(`Couldn't write platform log entry (${entry.action} ${entry.targetType} ${entry.targetId ?? ""}).`, e);
  }
}

export const LOGS_PAGE_SIZE = 50;

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  changes: AuditChange[];
  note: string | null;
};

const CANDIDATES_MAX = 500;

/**
 * What one search word can mean. The Logs keep the names as they were when something happened, so a word is
 * also looked up in the live tables (a club that was renamed, a staff member whose name changed, the person who
 * owns a club) and matched on their ids.
 */
async function wordClause(word: string): Promise<Prisma.PlatformAuditLogWhereInput> {
  // A web address ("https://walkerscc.squadino.com/") is matched on its host, and a club's own address on its slug too.
  const host = urlHost(word);
  const needle = host ?? word;
  const slug = host ? slugOfHost(host, ROOT_DOMAIN) : null;
  // Prisma passes % and _ through to LIKE as wildcards, so a typed one is escaped to be searched for literally.
  const like = { contains: escapeLike(needle), mode: "insensitive" as const };
  const [staff, clubs, owners, signups, inChanges] = await Promise.all([
    prisma.platformUser.findMany({ where: { OR: [{ name: like }, { email: like }] }, select: { id: true }, take: CANDIDATES_MAX }),
    prisma.club.findMany({
      where: { OR: [{ name: like }, { slug: like }, { code: like }, { customDomain: like }, ...(slug ? [{ slug }] : [])] },
      select: { id: true },
      take: CANDIDATES_MAX,
    }),
    // Club owners and admins: their name, username or email finds the club's records.
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: { not: "REMOVED" }, OR: [{ name: like }, { username: like }, { email: like }] },
      select: { clubId: true },
      take: CANDIDATES_MAX,
    }),
    prisma.signupRequest.findMany({
      where: {
        OR: [
          { clubName: like }, { registeredName: like }, { contactName: like }, { contactEmail: like }, { requestedUrl: like },
          ...(slug ? [{ requestedUrl: { contains: slug, mode: "insensitive" as const } }] : []),
        ],
      },
      select: { id: true },
      take: CANDIDATES_MAX,
    }),
    // What was changed, before and after (kept as JSON).
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM platform_audit_logs WHERE changes::text ILIKE ${`%${escapeLike(needle)}%`} LIMIT ${CANDIDATES_MAX}`,
  ]);

  const actions = actionsMatching(word);
  const staffIds = staff.map((u) => u.id);
  const targetIds = [...clubs.map((c) => c.id), ...owners.map((o) => o.clubId), ...signups.map((r) => r.id), ...staffIds];

  return {
    OR: [
      { targetLabel: like },
      { actorName: like },
      { actorRole: like },
      { note: like },
      { targetType: like },
      ...(actions.length ? [{ action: { in: actions } }] : []),
      ...(staffIds.length ? [{ actorId: { in: staffIds } }] : []),
      ...(targetIds.length ? [{ targetId: { in: targetIds } }] : []),
      ...(inChanges.length ? [{ id: { in: inChanges.map((r) => r.id) } }] : []),
    ],
  };
}

/**
 * A page of log entries, newest first, optionally narrowed by any of:
 *  - `task`: one kind of task (an action such as "club.setup_email"),
 *  - `from` / `to`: dates (yyyy-mm-dd, Melbourne days, both included),
 *  - `query`: words that ALL have to match something in the entry: the club or item name, a web address, who did it
 *    (name, email, role), the reason or note, what was changed, the wording of the task, a club's owner, or a date typed
 *    as 9/10/2026 or 2026-10-09,
 *  - `targetId`: the history of one item.
 * `missingTable` is true when the table doesn't exist yet, so the Logs page can say so instead of erroring.
 */
export async function listAuditLogs({ page = 1, targetId, query, task, from, to }: {
  page?: number;
  targetId?: string;
  query?: string;
  task?: string;
  from?: string;
  to?: string;
}): Promise<{
  rows: AuditLogRow[];
  total: number;
  missingTable: boolean;
}> {
  try {
    const words = searchWords(query);
    const days = words.map(parseDayWord);
    const textClauses = await Promise.all(words.filter((_, i) => !days[i]).map(wordClause));
    const dayClauses = days.flatMap((d) => (d ? [{ createdAt: melbourneRange(d, d) }] : []));
    const range = melbourneRange(parseDateInput(from), parseDateInput(to));
    const where: Prisma.PlatformAuditLogWhereInput = {
      AND: [
        ...(targetId ? [{ targetId }] : []),
        ...(isAuditAction(task) ? [{ action: task }] : []),
        ...(range.gte || range.lt ? [{ createdAt: range }] : []),
        ...dayClauses,
        ...textClauses,
      ],
    };
    const [rows, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Math.max(1, page) - 1) * LOGS_PAGE_SIZE,
        take: LOGS_PAGE_SIZE,
      }),
      prisma.platformAuditLog.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({ ...r, changes: Array.isArray(r.changes) ? (r.changes as unknown as AuditChange[]) : [] })),
      total,
      missingTable: false,
    };
  } catch (e) {
    // P2021: "The table does not exist in the current database."
    if ((e as { code?: string })?.code === "P2021") return { rows: [], total: 0, missingTable: true };
    throw e;
  }
}
