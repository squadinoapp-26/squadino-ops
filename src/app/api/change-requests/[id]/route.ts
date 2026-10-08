import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession, canApproveChanges } from "@/lib/auth";
import { decideChange } from "@/lib/changeRequests.server";
import { ChangeError } from "@/lib/changeError";
import { cleanReason } from "@/lib/changeRequests";

// An admin approves (the change is made now) or rejects a request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canApproveChanges(staff.role)) {
    return NextResponse.json({ error: "Only super admins and admins can approve or reject changes." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.decision !== "approve" && body?.decision !== "reject") {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }
  try {
    const result = await decideChange(id, body.decision, cleanReason(body.note), staff, {
      slug: typeof body.slug === "string" && body.slug.trim() ? body.slug : undefined,
    });
    return NextResponse.json(result, { status: result.status === "FAILED" ? 502 : 200 });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
