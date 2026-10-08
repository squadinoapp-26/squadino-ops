import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";
import { parseSignupReject } from "@/lib/changeRequests";
import { submitChange } from "@/lib/changeRequests.server";
import { ChangeError } from "@/lib/changeError";
import { pendingRequestFor } from "@/lib/signupReview.server";

// Rejecting a signup always needs a written reason. Super admins and admins reject straight away;
// a moderator (or customer care) only SENDS the rejection to an admin, who approves it or re-instates
// the signup (see submitChange: the same rule every other sensitive change follows).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewer = await getPlatformUser();
  if (!reviewer || !canReviewSignups(reviewer.role)) {
    return NextResponse.json({ error: "Only platform staff can reject signups." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = parseSignupReject(id, body?.reason);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const signup = await prisma.signupRequest.findUnique({ where: { id }, select: { clubName: true, status: true } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  if (await pendingRequestFor(id)) {
    return NextResponse.json({ error: "This signup is already waiting for an admin's decision. An admin needs to decide that first." }, { status: 409 });
  }

  try {
    const result = await submitChange(
      { type: "SIGNUP_REJECT", clubId: null, payload: parsed.payload, reason: parsed.payload.reason, targetLabel: signup.clubName },
      reviewer,
    );
    if ("done" in result) return NextResponse.json({ ok: true, rejected: true });

    // The request itself is logged by submitChange; this line puts it on the signup's own history too.
    await recordAudit(reviewer, {
      action: "signup.reject_requested",
      targetType: "signup",
      targetId: id,
      targetLabel: signup.clubName,
      note: `Reason: ${parsed.payload.reason}`,
    });
    return NextResponse.json({ ok: true, requested: true });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
