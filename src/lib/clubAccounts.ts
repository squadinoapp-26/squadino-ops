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
