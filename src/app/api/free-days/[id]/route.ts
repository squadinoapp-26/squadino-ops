import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canApproveChanges } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";
import { ClubAppError, continueFreeDaysInClubApp } from "@/lib/clubBillingApi.server";

// Finishes a free-days grant that was left half done: the clubs that were not reached or failed, and the emails still to send.
// Only an admin (the same people who approve the request), and only for a grant that was already made.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canApproveChanges(staff.role)) return NextResponse.json({ error: "Only super admins and admins can finish free days." }, { status: 403 });
  const { id } = await params;

  const grant = await prisma.freeDaysGrant.findUnique({ where: { id }, select: { id: true, title: true } }).catch(() => null);
  if (!grant) return NextResponse.json({ error: "Free days not found." }, { status: 404 });

  try {
    const summary = await continueFreeDaysInClubApp(grant.id);
    await recordAudit(staff, {
      action: "free_days.retried",
      targetType: "free_days",
      targetId: grant.id,
      targetLabel: grant.title,
      note: `${summary.applied} of ${summary.total} clubs done, ${summary.failed} not done, ${summary.emailed} emailed${summary.emailProblems ? `, ${summary.emailProblems} with an email still to send` : ""}`,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    if (e instanceof ClubAppError) return NextResponse.json({ error: e.message }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
    throw e;
  }
}
