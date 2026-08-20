import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import { PlatformRole } from "@/generated/prisma/enums";

const VALID_ROLES = Object.values(PlatformRole);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageStaff(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === staff.id) return NextResponse.json({ error: "You can't change your own role or access" }, { status: 400 });

  const { role, active } = await req.json().catch(() => ({}));
  const data: { role?: PlatformRole; active?: boolean } = {};
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    data.role = role as PlatformRole;
  }
  if (active !== undefined) {
    if (typeof active !== "boolean") return NextResponse.json({ error: "Invalid active flag" }, { status: 400 });
    data.active = active;
  }

  const user = await prisma.platformUser.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
