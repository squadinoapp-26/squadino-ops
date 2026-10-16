// Search and filter for Manage accounts (/clubs). Pure, so it's
// unit-tested without a database.

export const CLUB_ACCOUNT_FILTERS = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
  notlive: "Subdomain not live",
} as const;

export type ClubAccountFilter = keyof typeof CLUB_ACCOUNT_FILTERS;

export function isClubAccountFilter(value: unknown): value is ClubAccountFilter {
  return typeof value === "string" && value in CLUB_ACCOUNT_FILTERS;
}

type ClubLike = { name: string; code: string; slug: string; customDomain: string | null; active: boolean; subdomainReady: boolean };

/** Clubs matching the search text (name, code, web address or own domain) and the filter. */
export function filterClubAccounts<T extends ClubLike>(clubs: T[], q: string, filter: ClubAccountFilter): T[] {
  const needle = q.trim().toLowerCase();
  return clubs.filter((c) => {
    if (filter === "active" && !c.active) return false;
    if (filter === "inactive" && c.active) return false;
    if (filter === "notlive" && (c.subdomainReady || !c.active)) return false;
    if (!needle) return true;
    return [c.name, c.code, c.slug, c.customDomain ?? ""].some((v) => v.toLowerCase().includes(needle));
  });
}

/** 1250 -> "1,250". Done by hand so the answer never depends on the machine's locale data. */
function withThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface ClubPlanLabels {
  /** What the package badge says. */
  packageLabel: string;
  /** "ok": on a package. "warn": no package AND no override, so the club cannot add members. "none": no package but an override lets it add members. */
  packageTone: "ok" | "warn" | "none";
  /** Why a "warn" badge is amber, for the hover text. Empty otherwise. */
  packageHint: string;
  /** What the override badge says, or null when the club has no override. */
  overrideLabel: string | null;
}

/**
 * What a Manage accounts card says about a club's package and its user limit override. A club with no package and
 * no override can't add any member (the club app refuses until staff pick one), so that case is called out; a club
 * with an override but no package can still add members up to the override, so it is not.
 */
export function clubPlanLabels(club: { package: { name: string } | null; userCapOverride: number | null }): ClubPlanLabels {
  const hasOverride = club.userCapOverride != null;
  const overrideLabel = hasOverride ? `User limit override: ${withThousands(club.userCapOverride as number)}` : null;
  if (club.package) {
    return { packageLabel: `Package: ${club.package.name}`, packageTone: "ok", packageHint: "", overrideLabel };
  }
  if (hasOverride) {
    return { packageLabel: "No package", packageTone: "none", packageHint: "", overrideLabel };
  }
  return {
    packageLabel: "No package (can't add members)",
    packageTone: "warn",
    packageHint: "This club has no package and no user limit override, so it can't add any new members until one is set.",
    overrideLabel,
  };
}
