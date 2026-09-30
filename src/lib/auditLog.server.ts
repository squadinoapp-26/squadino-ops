import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction, AuditChange, AuditTargetType } from "@/lib/auditLog";

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

/**
 * A page of log entries, newest first, optionally only those for one item.
 * `missingTable` is true when the table doesn't exist yet, so the Logs page
 * can say so instead of erroring.
 */
export async function listAuditLogs({ page = 1, targetId }: { page?: number; targetId?: string }): Promise<{
  rows: AuditLogRow[];
  total: number;
  missingTable: boolean;
}> {
  const where = targetId ? { targetId } : {};
  try {
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
