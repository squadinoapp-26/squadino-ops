// The platform-wide sports list (the Sport table, managed at
// /sports) — the pure, client-safe half. Reading the table lives in
// sportCatalog.server.ts.

export interface CatalogSport {
  name: string;
  icon: string;
}

// What the table is filled with the first time it's read, and the fallback
// if it can't be read at all (e.g. before its migration has run). The 20
// the signup forms always offered, plus the distinct extras the club App
// Settings picker had. Website/src/lib/sports.ts keeps the same list as the
// marketing site's fallback.
export const DEFAULT_SPORTS: CatalogSport[] = [
  { name: "Athletics", icon: "🏃" },
  { name: "Australian Football", icon: "🏉" },
  { name: "Badminton", icon: "🏸" },
  { name: "Baseball", icon: "⚾" },
  { name: "Basketball", icon: "🏀" },
  { name: "Boxing", icon: "🥊" },
  { name: "Cricket", icon: "🏏" },
  { name: "Cycling", icon: "🚴" },
  { name: "Football (Soccer)", icon: "⚽" },
  { name: "Golf", icon: "⛳" },
  { name: "Gymnastics", icon: "🤸" },
  { name: "Hockey", icon: "🏑" },
  { name: "Martial Arts", icon: "🥋" },
  { name: "Netball", icon: "🥅" },
  { name: "Rowing", icon: "🚣" },
  { name: "Rugby", icon: "🏉" },
  { name: "Rugby League", icon: "🏉" },
  { name: "Rugby Union", icon: "🏉" },
  { name: "Sailing", icon: "⛵" },
  { name: "Softball", icon: "🥎" },
  { name: "Surf Lifesaving", icon: "🏄" },
  { name: "Swimming", icon: "🏊" },
  { name: "Table Tennis", icon: "🏓" },
  { name: "Tennis", icon: "🎾" },
  { name: "Triathlon", icon: "🏅" },
  { name: "Volleyball", icon: "🏐" },
  { name: "Water Polo", icon: "🤽" },
];

export const SPORT_NAME_MAX = 40;

export function sortSports<T extends { name: string }>(sports: T[]): T[] {
  return [...sports].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Picker options that always include the club's current sport(s), even ones
 * that were never on the list or have since been removed — a dropdown with
 * no matching option silently *displays* its first option instead, which is
 * how a Hockey club used to show up as "Swimming" in the platform editor.
 */
export function withCurrentSports(options: string[], current: (string | null | undefined)[]): string[] {
  const missing = current.filter((s): s is string => !!s && !options.includes(s));
  return [...options, ...Array.from(new Set(missing))];
}

/** Trims and validates a sport name typed by a platform admin. */
export function cleanSportName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Enter a sport name." };
  if (name.length > SPORT_NAME_MAX) return { ok: false, error: `Keep it under ${SPORT_NAME_MAX} characters.` };
  return { ok: true, name };
}
