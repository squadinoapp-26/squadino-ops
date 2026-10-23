import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession, canApproveChanges } from "@/lib/auth";
import { needsExclusiveAccess } from "@/lib/clubAccess";
import { heartbeatClubAccess, readLiveHolder } from "@/lib/clubAccess.server";

// Who has this club's account open (one customer care officer or moderator at a time; see clubAccess.ts).
// GET: looked at by the "waiting" screen and by an admin's panel every few seconds. It never takes the club.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { enabled, holder } = await readLiveHolder(id);
  return NextResponse.json({
    enabled,
    holder,
    mine: !!holder && holder.staffId === staff.id,
    canTakeOver: canApproveChanges(staff.role),
  });
}

// POST: the open page's "still here" (every 30 seconds). Body: { active: boolean }, true when the person touched the page since the
// last one. Answers { ok: true }, or { ok: false, reason } when the hold has ended (the page then covers itself with a message).
// Admins hold nothing, so for them it is a no-op.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!needsExclusiveAccess(staff.role)) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  const active = body?.active === true;
  return NextResponse.json(await heartbeatClubAccess(staff, id, active));
}
