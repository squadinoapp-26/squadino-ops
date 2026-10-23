import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canApproveChanges } from "@/lib/auth";
import { takeOverClubAccess } from "@/lib/clubAccess.server";

// An admin ends the access of the customer care officer or moderator who has this club open. Their page covers itself within seconds and
// every change they try is refused from this moment. Only super admins and admins (the ones never held back); written to the Logs.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canApproveChanges(staff.role)) return NextResponse.json({ error: "Only an admin can take over an account." }, { status: 403 });
  const { id } = await params;
  const club = await prisma.club.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  const { tookFrom } = await takeOverClubAccess(staff, club);
  return NextResponse.json({ ok: true, tookFrom });
}
