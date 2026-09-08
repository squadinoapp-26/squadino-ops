import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManagePackages } from "@/lib/auth";

// Reassign a club's package and/or override its effective user cap
// independently of the package. Super admin only — these are billing-adjacent
// decisions (see canManagePackages).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManagePackages(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const club = await prisma.club.findUnique({ where: { id }, select: { id: true } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { packageId?: string | null; userCapOverride?: number | null } = {};

  if ("packageId" in body) {
    if (body.packageId === null) {
      data.packageId = null;
    } else if (typeof body.packageId === "string" && body.packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: body.packageId }, select: { id: true } });
      if (!pkg) return NextResponse.json({ error: "That package doesn't exist" }, { status: 400 });
      data.packageId = pkg.id;
    } else {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }
  }

  if ("userCapOverride" in body) {
    if (body.userCapOverride === null) {
      data.userCapOverride = null;
    } else if (typeof body.userCapOverride === "number" && Number.isInteger(body.userCapOverride) && body.userCapOverride >= 1) {
      data.userCapOverride = body.userCapOverride;
    } else {
      return NextResponse.json(
        { error: "User cap override must be a positive whole number, or blank to remove the override" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.club.update({
    where: { id },
    data,
    select: { id: true, packageId: true, userCapOverride: true },
  });
  return NextResponse.json(updated);
}
