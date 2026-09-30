import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOwnerSetupEmails } from "@/lib/clubSetupEmails";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

// The "Send setup email" button on /clubs/[id]: emails the club's
// owner (any admin who has never signed in) a one-time link to set their
// password. Pressing it again sends a fresh link and voids the old one.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPlatformUser();
  if (!canReviewSignups(actor?.role)) {
    return NextResponse.json({ error: "Only platform admins and moderators can send setup emails." }, { status: 403 });
  }

  const club = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, code: true, slug: true, subdomainReady: true, active: true },
  });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (!club.active) return NextResponse.json({ error: "This club is inactive — reactivate it first." }, { status: 400 });

  const sentTo = await sendOwnerSetupEmails(club);
  if (sentTo.length === 0) {
    return NextResponse.json({ error: "Every admin of this club has already signed in, so there's no one to send a setup email to." }, { status: 400 });
  }
  await recordAudit(actor, {
    action: "club.setup_email",
    targetType: "club",
    targetId: id,
    targetLabel: club.name,
    note: `Sent to ${sentTo.join(", ")}`,
  });
  return NextResponse.json({ ok: true, sentTo });
}
