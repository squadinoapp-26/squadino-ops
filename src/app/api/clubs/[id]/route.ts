import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageClients, canManagePackages } from "@/lib/auth";
import { isValidSlug } from "@/lib/clubProvisioning";

// Club admin — package/user-cap (billing-adjacent, canManagePackages/SUPER_ADMIN
// only) and the club's URL fields (subdomain slug, "subdomain is live", and its
// optional bring-your-own custom domain — canManageClients/ADMIN+, same as
// creating clients). See src/lib/hostClub.ts and proxy.ts for how these three
// fields actually get used to route a request.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageClients(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const club = await prisma.club.findUnique({ where: { id }, select: { id: true } });
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
