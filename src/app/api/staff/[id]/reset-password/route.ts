import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordPolicy";
import { wasPasswordUsed, recordPasswordHistory } from "@/lib/passwordHistory";

// Admin-set password reset for another staff account. The admin supplies (or
// generates) a new password to share with them directly — separate from the
// self-service "forgot password" email flow, useful when the target can't
// receive email or the change needs to happen immediately.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageStaff(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.platformUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Staff account not found" }, { status: 404 });

  const { password } = await req.json().catch(() => ({}));
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await wasPasswordUsed(target.email, password, [target.passwordHash])) {
    return NextResponse.json({ error: "That staff member has used that password before. Choose a different one." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.platformUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.platformSession.deleteMany({ where: { platformUserId: id } }),
  ]);
  await recordPasswordHistory(target.email, target.passwordHash);

  return NextResponse.json({ ok: true });
}
