import { prisma } from "./prisma";

// Mirrors squadino's own src/lib/clubs.ts (RESERVED_SLUGS/isValidSlug/slugify/
// codify/createClub) — kept in sync by hand, same as the schema mirror. Ops
// creates a club directly (sales-assisted/manual onboarding), unlike
// squadino's self-serve /get-started wizard, but the slug is the same
// {slug}.squadino.com subdomain segment either way so it must follow the
// same DNS-label rules.
export const RESERVED_SLUGS = new Set([
  "app", "www", "api", "admin", "platform", "ops", "assets", "static",
  "mail", "ftp", "login", "register", "get-started", "dashboard", "squadino",
]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

function slugify(s: string) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);
  return base || "club";
}

function codify(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CLUB";
}

export interface NewClubInput {
  name: string;
  sports: string[];
  orgType: string;
  slug?: string;
  packageId?: string | null;
}

type CreateClubResult =
  | { ok: true; club: Awaited<ReturnType<typeof prisma.club.create>> }
  | { ok: false; error: string; status: number };

/**
 * Creates a club for a manually-onboarded client. Slug/code collisions are
 * retried with a random suffix, same as squadino's self-serve path, so an
 * ops staffer never hits a 409 just because a name is already taken.
 */
export async function createClub(input: NewClubInput): Promise<CreateClubResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Organisation name is required", status: 400 };
  if (input.sports.length === 0) return { ok: false, error: "Please pick at least one sport", status: 400 };

  const wantCode = codify(name);
  const requestedSlug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
  const wantSlug = isValidSlug(requestedSlug) ? requestedSlug : `${requestedSlug}-club`;

  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = attempt === 0 ? "" : String(Math.floor(Math.random() * 9000) + 1000);
    const code = (wantCode + suffix).slice(0, 12);
    const slug = suffix ? `${wantSlug}-${suffix}` : wantSlug;
    try {
      const club = await prisma.club.create({
        data: {
          name,
          code,
          slug,
          sport: input.sports[0],
          sports: input.sports,
          orgType: input.orgType || "Club",
          active: true,
          packageId: input.packageId || null,
        },
      });
      return { ok: true, club };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Unique constraint")) continue;
      return { ok: false, error: "Failed to create club", status: 500 };
    }
  }
  return { ok: false, error: "Could not generate a unique club code/slug, please try a different name or slug", status: 409 };
}

// Every club needs its one open, club-wide chat — mirrors squadino's
// createGeneralChatGroup so a manually-provisioned club looks identical to a
// self-serve one from day one.
export async function createGeneralChatGroup(clubId: string, ownerId: string) {
  await prisma.chatGroup.create({
    data: {
      clubId,
      name: "General Announcements",
      isGeneral: true,
      isPublic: true,
      status: "ACTIVE",
      createdById: ownerId,
      supervisorId: ownerId,
      members: { create: { userId: ownerId, isAdmin: true, approved: true } },
    },
  });
}
