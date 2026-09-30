import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewer = await getPlatformUser();
  if (!canReviewSignups(reviewer?.role)) {
    return NextResponse.json({ error: "Only platform admins and moderators can reject signups." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;

  const signup = await prisma.signupRequest.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  await prisma.signupRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedByPlatformUserId: reviewer!.id, rejectionReason: reason },
  });
  await recordAudit(reviewer, {
    action: "signup.reject",
    targetType: "signup",
    targetId: id,
    targetLabel: signup.clubName,
    note: reason ? `Reason: ${reason}` : null,
  });

  return NextResponse.json({ ok: true });
}
