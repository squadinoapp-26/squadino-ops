import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import { parseNewStaff, PLATFORM_ROLE_LABELS } from "@/lib/platformStaff";
import { recordAudit } from "@/lib/auditLog.server";

export async function POST(req: NextRequest) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageStaff(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseNewStaff(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, email, role, password } = parsed.data;

  if (await prisma.platformUser.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
  }
  const user = await prisma.platformUser.create({
    data: { name, email, role, passwordHash: await hashPassword(password) },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  await recordAudit(staff, {
    action: "staff.add",
    targetType: "staff",
    targetId: user.id,
    targetLabel: `${user.name} (${user.email})`,
    note: `Role: ${PLATFORM_ROLE_LABELS[role]}`,
  });
  return NextResponse.json(user, { status: 201 });
}
