import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageClients } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordPolicy";
import { wasPasswordUsed, recordPasswordHistory } from "@/lib/passwordHistory";

// Admin-set password reset for a club's own staff account — deliberately
// scoped to SUPER_ADMIN/ADMIN/MODERATOR only (not regular members like
// coaches/athletes/parents), for when a club's own admin is locked out and
// can't use their self-service "forgot password" flow. Mirrors
// api/staff/[id]/reset-password (the platform-staff equivalent) — same
// password rules, history check, and session revocation.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageClients(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(target.role)) {
    return NextResponse.json({ error: "This tool only resets passwords for club Super Admins, Admins and Moderators — not regular members" }, { status: 403 });
  }

  const { password } = await req.json().catch(() => ({}));
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await wasPasswordUsed(target.email, password, [target.passwordHash])) {
    return NextResponse.json({ error: "That person has used that password before. Choose a different one." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);
  await recordPasswordHistory(target.email, target.passwordHash);

  return NextResponse.json({ ok: true });
}
