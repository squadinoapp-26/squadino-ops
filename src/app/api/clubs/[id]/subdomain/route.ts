import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/hostClub";
import { ensureProjectDomain } from "@/lib/vercelDomains";
import { sendSubdomainLiveEmails } from "@/lib/clubSetupEmails";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

// The "Set up subdomain" button on /clubs/[id]: adds
// {slug}.squadino.com to this app's Vercel project and, once Vercel reports
// it verified and pointed at Vercel, switches the club's subdomain on. Safe
// to press again — a "pending" answer just means DNS/verification hasn't
// caught up yet.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPlatformUser();
  if (!canReviewSignups(actor?.role)) {
    return NextResponse.json({ error: "Only platform admins and moderators can set up subdomains." }, { status: 403 });
  }

  const club = await prisma.club.findUnique({ where: { id }, select: { id: true, name: true, slug: true, subdomainReady: true } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (club.subdomainReady) return NextResponse.json({ status: "ready" });

  const result = await ensureProjectDomain(`${club.slug}.${ROOT_DOMAIN}`);
  if (result.status !== "ready") {
    return NextResponse.json(result, { status: result.status === "error" ? 502 : 202 });
  }

  await prisma.club.update({ where: { id }, data: { subdomainReady: true } });
  await recordAudit(actor, {
    action: "club.subdomain",
    targetType: "club",
    targetId: id,
    targetLabel: club.name,
    changes: [{ field: "subdomainReady", label: "Subdomain live", from: false, to: true }],
    note: `${club.slug}.${ROOT_DOMAIN}`,
  });
  await sendSubdomainLiveEmails(club);
  return NextResponse.json({ status: "ready" });
}
