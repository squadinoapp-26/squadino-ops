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

// ── Short web-address suggestions ───────────────────────────────────────────
// The approve screen suggests short addresses instead of the whole club name (owner, 2026-10-19:
// "Clayton Cricket Club" -> "ccc"). Initials can clash between clubs, so the admin is offered a few
// choices and the screen marks the ones already taken. Kept identical in the club app and ops.

// Words that add nothing to a short name ("The Walkers Club of Berwick" -> walkers, club, berwick).
const FILLER_WORDS = new Set(["the", "of", "and"]);

export interface SubdomainSuggestion {
  slug: string;
  /** Plain words for the button, e.g. "Initials". */
  label: string;
}

// Lowercase words of a club name with accents and punctuation removed; filler words are left out
// unless that would leave nothing.
function meaningfulWords(clubName: string): string[] {
  const words = clubName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !FILLER_WORDS.has(w));
  return meaningful.length ? meaningful : words;
}

/**
 * Short web addresses for a club name, best first, each valid and different:
 * three or more words give the initials ("Clayton Cricket Club" -> ccc) and the first word plus initials
 * (claytoncc, the pattern most live clubs already use); two words give the words joined up; the whole
 * name (clayton-cricket-club) is always the last choice. Reserved words are never offered.
 */
export function suggestSubdomains(clubName: string): SubdomainSuggestion[] {
  const words = meaningfulWords(clubName);
  const out: SubdomainSuggestion[] = [];
  const add = (slug: string, label: string) => {
    if (slug && isValidSlug(slug) && !out.some((o) => o.slug === slug)) out.push({ slug, label });
  };
  if (words.length >= 3) {
    add(words.map((w) => w[0]).join(""), "Initials");
    add(words[0] + words.slice(1).map((w) => w[0]).join(""), "First word + initials");
  } else if (words.length === 2) {
    add(words.join(""), "Words joined up");
  }
  add(slugify(clubName), "Full name");
  return out;
}
