import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { loadLiveVersion } from "@/lib/liveVersion.server";

// A short fingerprint of what the console shows, so an open page can tell when to re-read itself (src/components/LiveRefresh.tsx).
// Any signed-in staff member may ask; it carries no data, only a value that changes when something does.
export async function GET() {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ v: await loadLiveVersion() }, { headers: { "Cache-Control": "no-store" } });
}
