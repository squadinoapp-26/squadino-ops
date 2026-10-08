import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession, canApproveChanges } from "@/lib/auth";
import { cleanReason } from "@/lib/changeRequests";
import { ChangeError } from "@/lib/changeRequests.server";
import { reinstateSignup } from "@/lib/signupRejection.server";

// Puts a rejected signup back in the queue of signups waiting for review. Super admins and admins only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canApproveChanges(staff.role)) {
    return NextResponse.json({ error: "Only super admins and admins can re-instate a rejected signup." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await reinstateSignup(id, staff, cleanReason(body?.note));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
