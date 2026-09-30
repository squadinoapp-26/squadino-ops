import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageClients, canManagePackages } from "@/lib/auth";
import { isValidSlug } from "@/lib/clubProvisioning";
import { canManageClubStatus, getPlatformUser } from "@/lib/auth";
import { diffFields } from "@/lib/auditLog";
import { recordAudit } from "@/lib/auditLog.server";
import { canDeleteClub, deletableFrom } from "@/lib/clubStatus";
import { getDeactivationDates, isClubNeverUsed } from "@/lib/clubStatus.server";
import { removeProjectDomain } from "@/lib/vercelDomains";
import { ROOT_DOMAIN } from "@/lib/hostClub";

// Club admin — package/user-cap (billing-adjacent, canManagePackages/SUPER_ADMIN
// only) and the club's URL fields (subdomain slug, "subdomain is live", and its
// optional bring-your-own custom domain — canManageClients/ADMIN+, same as
// creating clients). See src/lib/hostClub.ts and proxy.ts for how these three
// fields actually get used to route a request.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageClients(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const club = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, subdomainReady: true, customDomain: true, packageId: true, userCapOverride: true },
  });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: {
    packageId?: string | null; userCapOverride?: number | null;
    slug?: string; subdomainReady?: boolean; customDomain?: string | null;
  } = {};

  if ("packageId" in body || "userCapOverride" in body) {
    if (!canManagePackages(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if ("packageId" in body) {
      if (body.packageId === null) {
        data.packageId = null;
      } else if (typeof body.packageId === "string" && body.packageId) {
        const pkg = await prisma.package.findUnique({ where: { id: body.packageId }, select: { id: true } });
        if (!pkg) return NextResponse.json({ error: "That package doesn't exist" }, { status: 400 });
        data.packageId = pkg.id;
      } else {
        return NextResponse.json({ error: "Invalid package" }, { status: 400 });
      }
    }

    if ("userCapOverride" in body) {
      if (body.userCapOverride === null) {
        data.userCapOverride = null;
      } else if (typeof body.userCapOverride === "number" && Number.isInteger(body.userCapOverride) && body.userCapOverride >= 1) {
        data.userCapOverride = body.userCapOverride;
      } else {
        return NextResponse.json(
          { error: "User cap override must be a positive whole number, or blank to remove the override" },
          { status: 400 },
        );
      }
    }
  }

  if ("slug" in body) {
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "Slug must be lowercase letters, numbers and hyphens only, and not a reserved word" }, { status: 400 });
    }
    data.slug = slug;
  }

  if ("subdomainReady" in body) {
    data.subdomainReady = !!body.subdomainReady;
  }

  if ("customDomain" in body) {
    if (body.customDomain === null || body.customDomain === "") {
      data.customDomain = null;
    } else if (typeof body.customDomain === "string") {
      data.customDomain = body.customDomain.trim().toLowerCase();
    } else {
      return NextResponse.json({ error: "Invalid custom domain" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.club.update({
      where: { id },
      data,
      select: { id: true, packageId: true, userCapOverride: true, slug: true, subdomainReady: true, customDomain: true },
    });
    await recordAudit(staff, {
      action: "club.edit",
      targetType: "club",
      targetId: id,
      targetLabel: club.name,
      changes: diffFields(club, updated, [
        { key: "slug", label: "Slug" },
        { key: "subdomainReady", label: "Subdomain live" },
        { key: "customDomain", label: "Custom domain" },
        { key: "packageId", label: "Package" },
        { key: "userCapOverride", label: "User cap override" },
      ]),
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") && msg.includes("slug")) {
      return NextResponse.json({ error: "That subdomain is already taken by another club" }, { status: 409 });
    }
    if (msg.includes("Unique constraint") && msg.includes("customDomain")) {
      return NextResponse.json({ error: "That custom domain is already in use by another club" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

const melbourneDate = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "long" });

// "Delete permanently" on /clubs/[id]. Clubs are deactivated rather
// than deleted; a super admin or admin can delete one for good once it has
// been inactive for 12 months, or straight away if nobody ever signed in to
// it (src/lib/clubStatus.ts). Everything goes: the club's data, its
// face-blur profiles and its address on Vercel.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPlatformUser();
  if (!canManageClubStatus(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can delete clubs." }, { status: 403 });
  }

  const club = await prisma.club.findUnique({
    where: { id },
    select: { name: true, code: true, slug: true, active: true, _count: { select: { faceProfiles: true } } },
  });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const deactivatedAt = (await getDeactivationDates([{ id, active: club.active }]))?.get(id) ?? null;
  const neverUsed = await isClubNeverUsed(id);
  if (!canDeleteClub({ active: club.active, deactivatedAt, neverUsed })) {
    const error = club.active
      ? neverUsed
        ? "Deactivate the club first. As nobody has used it, it can then be deleted straight away."
        : "Deactivate the club first. It can be deleted 12 months after that."
      : deactivatedAt
        ? `This club can be deleted from ${melbourneDate.format(deletableFrom(deactivatedAt))}, 12 months after it was deactivated.`
        : "The date this club was deactivated isn't recorded yet — run the database update (db-sync.cmd) first.";
    return NextResponse.json({ error }, { status: 409 });
  }

  try {
    // A few club-scoped tables reference users with ON DELETE RESTRICT
    // (news, events, documents, banned words, chat messages, merch orders),
    // and face-blur profiles reference the club the same way, so a plain
    // club.delete() would fail once the club has any real content. Delete
    // those rows first (their own children cascade), then delete the club —
    // which cascades everything else (users, sessions, chat groups, sponsors,
    // staff, …).
    await prisma.$transaction([
      prisma.news.deleteMany({ where: { clubId: id } }),
      prisma.event.deleteMany({ where: { clubId: id } }),
      prisma.document.deleteMany({ where: { clubId: id } }),
      prisma.bannedWord.deleteMany({ where: { clubId: id } }),
      prisma.chatMessage.deleteMany({ where: { group: { clubId: id } } }),
      prisma.merchOrder.deleteMany({ where: { user: { clubId: id } } }),
      prisma.faceProfile.deleteMany({ where: { clubId: id } }),
      prisma.club.delete({ where: { id } }),
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to delete club: ${msg}` }, { status: 500 });
  }

  // The club is gone either way; taking its address off Vercel is tidy-up.
  const host = `${club.slug}.${ROOT_DOMAIN}`;
  const vercel = await removeProjectDomain(host);
  const faces = club._count.faceProfiles;
  await recordAudit(actor, {
    action: "club.delete",
    targetType: "club",
    targetId: id,
    targetLabel: club.name,
    note: [
      `Club code ${club.code}`,
      neverUsed ? "never used" : null,
      `${faces} face-blur profile${faces === 1 ? "" : "s"} deleted`,
      vercel === "removed" ? `${host} removed from Vercel` : vercel === "skipped" ? null : `Couldn't remove ${host} from Vercel: ${vercel.error}`,
    ].filter(Boolean).join(" · "),
  });
  return NextResponse.json({ ok: true });
}
