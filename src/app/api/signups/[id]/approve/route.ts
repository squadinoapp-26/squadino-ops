import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canReviewSignups, canApproveChanges } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";
import { cleanReason, parseSignupPreApprove } from "@/lib/changeRequests";
import { submitChange } from "@/lib/changeRequests.server";
import { ChangeError } from "@/lib/changeError";
import { approveSignup, checkWebAddress } from "@/lib/signupApproval.server";
import { pendingRequestFor } from "@/lib/signupReview.server";
import { ROOT_DOMAIN } from "@/lib/hostClub";

// Step 1 of setting a new client up. Super admins and admins approve here and now, with a written reason, which
// creates the Club + owner account. A moderator or customer care officer can only PRE-APPROVE (they have checked
// the signup and, for a paid plan, its payment in Stripe; notes are optional): that goes to an admin, who makes the
// final approval. Either way nothing is emailed yet: the admin then sets the club's subdomain up and sends the
// owner's setup email from /clubs/[id] (see the setup routes there).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reviewer = await getPlatformUser();
  if (!reviewer || !canReviewSignups(reviewer.role)) {
    return NextResponse.json({ error: "Only platform staff can approve signups." }, { status: 403 });
  }

  const signup = await prisma.signupRequest.findUnique({ where: { id }, select: { clubName: true, status: true, stripeCustomerId: true } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  if (await pendingRequestFor(id)) {
    return NextResponse.json(
      { error: "This signup is already waiting for an admin's decision. An admin needs to decide that first." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));

  try {
    if (canApproveChanges(reviewer.role)) {
      const reason = cleanReason(body?.reason);
      if (!reason) return NextResponse.json({ error: "Give a reason for approving this signup." }, { status: 400 });
      const result = await approveSignup({
        signupId: id,
        slug: body?.slug,
        paymentChecked: body?.paymentChecked === true,
        actor: reviewer,
        note: `Reason: ${reason}`,
      });
      return NextResponse.json({ ok: true, clubId: result.clubId, clubCode: result.clubCode });
    }

    // A pre-approval: checked here so the admin isn't sent something that can't be approved.
    const parsed = parseSignupPreApprove(id, body, { needsPaymentCheck: !!signup.stripeCustomerId });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const slug = await checkWebAddress(parsed.payload.slug);
    const payload = { ...parsed.payload, slug };

    await submitChange({ type: "SIGNUP_PREAPPROVE", clubId: null, payload, reason: payload.notes, targetLabel: signup.clubName }, reviewer);
    // The request itself is logged by submitChange; this line puts it on the signup's own history too.
    await recordAudit(reviewer, {
      action: "signup.preapprove",
      targetType: "signup",
      targetId: id,
      targetLabel: signup.clubName,
      note: [
        slug ? `Web address ${slug}.${ROOT_DOMAIN}` : "Web address from the club name",
        payload.paymentChecked ? "payment checked" : "no payment to check",
        payload.notes ? `Notes: ${payload.notes}` : null,
      ].filter(Boolean).join(" · "),
    });
    return NextResponse.json({ ok: true, requested: true });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
