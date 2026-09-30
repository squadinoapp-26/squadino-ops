import { prisma } from "@/lib/prisma";
import { VERSION_MODULES } from "@/lib/modules";
import { AppVersion } from "@/generated/prisma/enums";
import { isValidSlug, slugify } from "@/lib/subdomain";
import { isUnknownEnumValue } from "@/lib/prismaErrors";

function codify(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CLUB";
}

type CreateResult =
  | { ok: true; club: Awaited<ReturnType<typeof prisma.club.create>> }
  | { ok: false; error: string; status: number };

/**
 * Creates a club from wizard/form input. Accepts either the new wizard shape
 * (`sports` array, address fields, `orgType`) or the legacy single-form shape
 * (`sport`, explicit `code`/`slug`). Auto-derives code/slug from the name and
 * suffixes on collision so self-serve signups never fail on a taken name.
 */
export async function createClub(body: Record<string, unknown>): Promise<CreateResult> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "Organisation name is required", status: 400 };

  const sports: string[] = Array.isArray(body.sports)
    ? (body.sports as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : typeof body.sport === "string" && body.sport
      ? [body.sport]
      : [];
  if (sports.length === 0) return { ok: false, error: "Please pick at least one sport", status: 400 };
  const primarySport = sports[0];

  const wantCode = typeof body.code === "string" && body.code ? codify(body.code) : codify(name);
  const requestedSlug = typeof body.slug === "string" && body.slug ? slugify(body.slug) : slugify(name);
  // A reserved/invalid requested (or name-derived) slug never blocks signup —
  // it just falls back to a suffixed generic form; reserved-word rejection is
  // an admin-edit concern (see the platform club PATCH route), not something
  // a self-serve signer-upper should ever see fail on.
  const wantSlug = isValidSlug(requestedSlug) ? requestedSlug : `${requestedSlug}-club`;

  const appVersion = body.appVersion;
  const version: AppVersion = (typeof appVersion === "string" && Object.values(AppVersion).includes(appVersion as AppVersion)
    ? appVersion : "FREE") as AppVersion;
  const enabledModules = VERSION_MODULES[version] ?? VERSION_MODULES.FREE;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = attempt === 0 ? "" : String(Math.floor(Math.random() * 9000) + 1000);
    const code = (wantCode + suffix).slice(0, 12);
    // Only move off the wanted web address if it's actually taken — a clash
    // on the club code alone (two "Berwick…" clubs) mustn't change the
    // subdomain, especially one a platform admin picked when approving.
    const slugTaken = !!suffix && !!(await prisma.club.findUnique({ where: { slug: wantSlug }, select: { id: true } }));
    const slug = slugTaken ? `${wantSlug}-${suffix}` : wantSlug;
    try {
      const club = await prisma.club.create({
        data: {
          name,
          code,
          slug,
          sport: primarySport,
          sports,
          orgType: str(body.orgType) ?? "Club",
          description: typeof body.description === "string" ? body.description.slice(0, 150) || null : null,
          street: str(body.street),
          suburb: str(body.suburb),
          postcode: str(body.postcode),
          appVersion: version,
          logoUrl: str(body.logoUrl),
          enabledModules,
          active: true,
          stripeCustomerId: str(body.stripeCustomerId),
          stripeSubscriptionId: str(body.stripeSubscriptionId),
          trialEndsAt:
            typeof body.trialEndsAt === "string" && body.trialEndsAt ? new Date(body.trialEndsAt) : null,
        },
      });
      return { ok: true, club };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Unique constraint")) continue; // collision — retry with a new suffix
      if (isUnknownEnumValue(e)) {
        return { ok: false, error: `The live database doesn't know the ${version} plan yet — run the database update (db-sync) and try again.`, status: 503 };
      }
      return { ok: false, error: "Failed to create club", status: 500 };
    }
  }
  return { ok: false, error: "Could not generate a unique club code, please try a different name", status: 409 };
}
