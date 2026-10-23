import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { needsExclusiveAccess } from "@/lib/clubAccess";
import { releaseClubAccess } from "@/lib/clubAccess.server";

// "I've left this page": sent by the browser as the page closes (a beacon, so it carries no body and nobody reads the answer). The page's
// own marker comes in the address (?v=) and only frees the hold if it is still the current one, so a reload can't free the new page's hold.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!needsExclusiveAccess(staff.role)) return NextResponse.json({ ok: true });
  const { id } = await params;
  const viewId = new URL(req.url).searchParams.get("v") ?? "";
  if (viewId.length > 64) return NextResponse.json({ error: "Bad marker" }, { status: 400 });
  await releaseClubAccess(staff, id, viewId);
  return NextResponse.json({ ok: true });
}
