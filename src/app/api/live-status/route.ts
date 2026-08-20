import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { getLiveStatus } from "@/lib/presence";

export async function GET() {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getLiveStatus();
  return NextResponse.json(status);
}
