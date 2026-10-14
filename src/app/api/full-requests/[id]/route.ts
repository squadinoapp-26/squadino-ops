import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser, canManageFullPackage } from "@/lib/auth";
import { parseFullAction } from "@/lib/fullPackage";
import { runFullAction } from "@/lib/fullPackage.server";
import { ChangeError } from "@/lib/changeError";

// Send the Full package invoice (the number of members and the price per member are set here), cancel one that was
// sent by mistake, or close a request. The club app creates the Stripe invoice. Admins and super admins only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getPlatformUser();
  if (!staff || !canManageFullPackage(staff.role)) {
    return NextResponse.json({ error: "Only admins and super admins can handle Full package requests." }, { status: 403 });
  }

  const parsed = parseFullAction(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await runFullAction(id, parsed.action, { id: staff.id, name: staff.name, role: staff.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
