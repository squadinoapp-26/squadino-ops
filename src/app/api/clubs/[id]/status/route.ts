import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canManageClubStatus } from "@/lib/auth";
import { setClubActive } from "@/lib/clubStatus.server";
import { recordAudit } from "@/lib/auditLog.server";

// The Deactivate / Reactivate buttons on /clubs/[id]. Clubs are
// switched off instead of deleted: members are signed out and can't sign in,
// but nothing is removed and it can be undone. 12 months after deactivation
// the club can be deleted for good (see the DELETE route next door).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPlatformUser();
  if (!canManageClubStatus(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can deactivate or reactivate clubs." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Say whether the club should be active." }, { status: 400 });

  const club = await prisma.club.findUnique({ where: { id }, select: { name: true, active: true } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (club.active === body.active) return NextResponse.json({ ok: true, active: club.active });

  await setClubActive(id, body.active, actor);
  await recordAudit(actor, {
    action: body.active ? "club.reactivate" : "club.deactivate",
    targetType: "club",
    targetId: id,
    targetLabel: club.name,
    changes: [{ field: "active", label: "Active", from: club.active, to: body.active }],
  });
  return NextResponse.json({ ok: true, active: body.active });
}
