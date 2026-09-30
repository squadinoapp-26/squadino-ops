import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import { isPlatformRole, staffChangeProblem, PLATFORM_ROLE_LABELS, type PlatformRoleName } from "@/lib/platformStaff";
import { recordAudit } from "@/lib/auditLog.server";

// Change a staff member's role, or switch their account off / back on.
// Switching someone off signs them out straight away.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageStaff(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.platformUser.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!target) return NextResponse.json({ error: "Staff account not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body?.role !== undefined && !isPlatformRole(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (body?.active !== undefined && typeof body.active !== "boolean") return NextResponse.json({ error: "Invalid active flag" }, { status: 400 });
  const role: PlatformRoleName = isPlatformRole(body?.role) ? body.role : target.role;
  const next = { role, active: typeof body?.active === "boolean" ? body.active : target.active };
  if (next.role === target.role && next.active === target.active) return NextResponse.json(target);

  const activeSuperAdmins = await prisma.platformUser.count({ where: { role: "SUPER_ADMIN", active: true } });
  const problem = staffChangeProblem({ actorId: staff.id, target, next, activeSuperAdmins });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const user = await prisma.platformUser.update({
    where: { id },
    data: next,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  if (!next.active) await prisma.platformSession.deleteMany({ where: { platformUserId: id } });

  await recordAudit(staff, {
    action: "staff.edit",
    targetType: "staff",
    targetId: id,
    targetLabel: `${target.name} (${target.email})`,
    changes: [
      ...(next.role !== target.role ? [{ field: "role", label: "Role", from: PLATFORM_ROLE_LABELS[target.role], to: PLATFORM_ROLE_LABELS[next.role] }] : []),
      ...(next.active !== target.active ? [{ field: "active", label: "Active", from: target.active, to: next.active }] : []),
    ],
  });
  return NextResponse.json(user);
}
