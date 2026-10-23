import { prisma } from "@/lib/prisma";
import { EMAIL_PROBLEMS_SHOWN, emailProblemHref, emailProblemsSince, type EmailProblem } from "@/lib/emailProblems";

/** The emails that could not be sent in the last week, newest first (read from the Logs, which only ever grow). */
export async function listRecentEmailProblems(now = new Date()): Promise<{ problems: EmailProblem[]; total: number }> {
  const where = { action: "email.failed", createdAt: { gte: emailProblemsSince(now) } };
  const [rows, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EMAIL_PROBLEMS_SHOWN,
      select: { id: true, createdAt: true, targetType: true, targetId: true, targetLabel: true, note: true },
    }),
    prisma.platformAuditLog.count({ where }),
  ]);
  return {
    total,
    problems: rows.map((r) => ({ id: r.id, at: r.createdAt, label: r.targetLabel, href: emailProblemHref(r.targetType, r.targetId), note: r.note ?? "" })),
  };
}
