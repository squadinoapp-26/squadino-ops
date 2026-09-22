import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageClients } from "@/lib/auth";
import { createClub, createGeneralChatGroup, isValidSlug } from "@/lib/clubProvisioning";
import { hashPassword } from "@/lib/password";
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset.server";
import { sendEmail, welcomeEmail, squadinoAppUrl } from "@/lib/email";
import { randomBytes } from "crypto";

/**
 * Manually provisions a new client: creates the club, its owner ADMIN
 * account (random unusable password), the general chat group, and emails
 * the owner a set-password link into the main squadino app — same shape as
 * squadino's own /api/provisioning (Stripe-driven signups), just triggered
 * by staff instead of a webhook. The subdomain itself starts not-ready; DNS
 * + Vercel custom domain still need to be added, then "Subdomain is live"
 * flipped on from squadino's own /platform club editor.
 */
export async function POST(req: NextRequest) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageClients(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    name?: string; orgType?: string; sports?: string[]; slug?: string; packageId?: string | null;
    owner?: { name?: string; email?: string };
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = body.name?.trim() ?? "";
  const sports = (body.sports ?? []).filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const ownerName = body.owner?.name?.trim() ?? "";
  const ownerEmail = body.owner?.email?.toLowerCase().trim() ?? "";

  if (!name) return NextResponse.json({ error: "Organisation name is required" }, { status: 400 });
  if (sports.length === 0) return NextResponse.json({ error: "Please pick at least one sport" }, { status: 400 });
  if (!ownerName || !ownerEmail) return NextResponse.json({ error: "Owner name and email are required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "Please enter a valid owner email address" }, { status: 400 });
  }
  const slug = body.slug?.trim().toLowerCase();
  if (slug && !isValidSlug(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers and hyphens only, and not a reserved word" }, { status: 400 });
  }
  if (body.packageId) {
    const pkg = await prisma.package.findUnique({ where: { id: body.packageId }, select: { id: true } });
    if (!pkg) return NextResponse.json({ error: "That package doesn't exist" }, { status: 400 });
  }

  const result = await createClub({ name, sports, orgType: body.orgType ?? "Club", slug, packageId: body.packageId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const club = result.club;

  try {
    // Random, never-communicated password — the owner sets their real one via
    // the welcome email's reset link, same as squadino's /api/provisioning.
    const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
    const owner = await prisma.user.create({
      data: { clubId: club.id, name: ownerName, email: ownerEmail, passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    await createGeneralChatGroup(club.id, owner.id);
  } catch {
    await prisma.club.delete({ where: { id: club.id } }).catch(() => {});
    return NextResponse.json({ error: "Could not create the owner account — check whether that email is already in use" }, { status: 500 });
  }

  const token = await createResetToken(ownerEmail);
  const setPasswordUrl = `${squadinoAppUrl()}/reset-password?token=${token}`;
  const emailMsg = welcomeEmail(setPasswordUrl, club.name, RESET_TOKEN_TTL_MINUTES);
  const sent = await sendEmail({ ...emailMsg, to: ownerEmail });

  return NextResponse.json({
    ok: true,
    id: club.id,
    name: club.name,
    code: club.code,
    slug: club.slug,
    emailDelivered: sent.delivered,
  }, { status: 201 });
}
