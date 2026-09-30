import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { provisionSignup } from "@/lib/signupProvisioning";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";
import { normaliseSubdomain, subdomainProblem } from "@/lib/subdomain";
import { ROOT_DOMAIN } from "@/lib/hostClub";

// Step 1 of setting a new client up: a platform admin or moderator has
// checked the signup (and, for a paid plan, its payment in Stripe) and
// approves it, which creates the Club + owner account. Nothing is emailed
// yet — the admin then sets the club's subdomain up and sends the owner's
// setup email from /clubs/[id] (see the setup routes there).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reviewer = await getPlatformUser();
  if (!canReviewSignups(reviewer?.role)) {
    return NextResponse.json({ error: "Only platform admins and moderators can approve signups." }, { status: 403 });
  }

  const signup = await prisma.signupRequest.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  // A paid plan has a payment behind it; the reviewer must confirm they've
  // checked it before a club is created.
  const body = await req.json().catch(() => ({}));
  if (signup.stripeCustomerId && body?.paymentChecked !== true) {
    return NextResponse.json({ error: "Confirm you've checked this signup's payment first." }, { status: 400 });
  }

  // The club's {slug}.squadino.com, chosen by the approver so a long club
  // name doesn't become a long web address. Checked here rather than left to
  // createClub, which would quietly add a number to a taken one.
  let slug: string | undefined;
  if (typeof body?.slug === "string" && body.slug.trim()) {
    slug = normaliseSubdomain(body.slug);
    const problem = subdomainProblem(slug);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (await prisma.club.findUnique({ where: { slug }, select: { id: true } })) {
      return NextResponse.json({ error: `${slug}.${ROOT_DOMAIN} is already taken — pick another web address.` }, { status: 409 });
    }
  }

  const result = await provisionSignup(signup, slug);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.signupRequest.update({
    where: { id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedByPlatformUserId: reviewer!.id },
  });
  await recordAudit(reviewer, {
    action: "signup.approve",
    targetType: "signup",
    targetId: id,
    targetLabel: signup.clubName,
    note: `Created club ${result.club.name} (${result.club.code}) at ${result.club.slug}.${ROOT_DOMAIN}`,
  });

  return NextResponse.json({ ok: true, clubId: result.club.id, clubCode: result.club.code });
}
