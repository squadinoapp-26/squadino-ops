// Rules for a club's {slug}.squadino.com subdomain. Pure and client-safe, so
// the approve form can tidy what an admin types the same way the server
// checks it. clubs.ts re-exports these for existing callers.

// Reserved so a club can never claim a subdomain that collides with a real
// app route or one of our own hostnames (app.squadino.com, etc).
export const RESERVED_SLUGS = new Set([
  "app", "www", "api", "admin", "platform", "ops", "assets", "static",
  "mail", "ftp", "login", "register", "get-started", "dashboard", "squadino",
]);

// DNS-label-safe: lowercase letters/digits/hyphens only, no leading/trailing
// hyphen, 1-63 chars (the hard DNS label length limit), and not reserved.
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function slugify(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);
  // Non-ASCII names (e.g. entirely CJK/accented) can collapse to nothing —
  // fall back to a generic base so the collision-retry loop in createClub()
  // always has a real string to suffix, instead of "" vs "-1234".
  return base || "club";
}

/**
 * Tidies a subdomain typed by an admin: lowercase, spaces and other
 * characters become hyphens, no doubled or edge hyphens. A pasted full
 * address ("berwick.squadino.com", "https://berwick.squadino.com/") keeps
 * just the first part. Returns "" if nothing usable is left.
 */
export function normaliseSubdomain(raw: string): string {
  const host = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[./]/)[0] ?? "";
  return host.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

/** Why a (normalised) subdomain can't be used, or null if it's fine. */
export function subdomainProblem(slug: string): string | null {
  if (!slug) return "Enter a web address.";
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved — pick another web address.`;
  if (!isValidSlug(slug)) return "Use only letters, numbers and hyphens (up to 63 characters).";
  return null;
}
