// Restricted-word matching and tidying, shared by the club app's checks
// (src/lib/moderation.ts) and the platform's list editor. Pure and
// client-safe.

export const RESTRICTED_WORD_MAX = 60;

/**
 * One case-insensitive whole-word/phrase matcher for a word list, or null for
 * an empty list. Whole words, so "ass" doesn't flag "pass" and "coon" doesn't
 * flag "raccoon".
 */
export function buildWordMatcher(words: string[]): RegExp | null {
  const cleaned = words.map((w) => w.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const escaped = cleaned.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

/** Tidies a word or phrase typed by an admin: trimmed, lowercase, single spaces. */
export function cleanRestrictedWord(raw: unknown): { ok: true; word: string } | { ok: false; error: string } {
  const word = typeof raw === "string" ? raw.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (!word) return { ok: false, error: "Enter a word or phrase." };
  if (word.length > RESTRICTED_WORD_MAX) return { ok: false, error: `Keep it to ${RESTRICTED_WORD_MAX} characters or fewer.` };
  return { ok: true, word };
}
