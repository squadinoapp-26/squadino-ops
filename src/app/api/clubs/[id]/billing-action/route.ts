import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { submitChange, ChangeError } from "@/lib/changeRequests.server";
import { cleanReason, type ChangeType } from "@/lib/changeRequests";

const TYPES: Record<string, ChangeType> = { start_hold: "HOLD_START", resume: "HOLD_RESUME", cancel: "SUBSCRIPTION_CANCEL" };

// Account hold, resume and cancel. Anyone who can sign in may ask; an admin's request is carried out
// straight away, anyone else's goes to the Approvals list (202).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const type = typeof body?.action === "string" ? TYPES[body.action] : undefined;
  if (!type) return NextResponse.json({ error: "Choose hold, resume or cancel." }, { status: 400 });

  try {
    const result = await submitChange({ type, clubId: id, payload: {}, reason: cleanReason(body.reason) }, staff);
    return NextResponse.json(result, { status: "requested" in result ? 202 : 200 });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
