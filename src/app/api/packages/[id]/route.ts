import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManagePackages } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManagePackages(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, userCap, priceCents, trialDays, active } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (userCap !== null && (typeof userCap !== "number" || userCap < 1)) {
    return NextResponse.json({ error: "User cap must be a positive number, or blank for unlimited" }, { status: 400 });
  }
  if (typeof priceCents !== "number" || priceCents < 0) {
    return NextResponse.json({ error: "Price must be zero or more" }, { status: 400 });
  }
  if (trialDays !== null && (typeof trialDays !== "number" || trialDays < 0)) {
    return NextResponse.json({ error: "Trial days must be zero or more, or blank for no trial" }, { status: 400 });
  }

  const pkg = await prisma.package.update({
    where: { id },
    data: { name: name.trim(), userCap, priceCents, trialDays, active: !!active },
  });
  return NextResponse.json(pkg);
}

// DELETE /api/packages/[id] → only if no client is currently on this package.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManagePackages(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const inUse = await prisma.club.count({ where: { packageId: id } });
  if (inUse > 0) {
    return NextResponse.json({ error: `${inUse} client(s) are on this package — reassign them first.` }, { status: 409 });
  }

  await prisma.package.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
