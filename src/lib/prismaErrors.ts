// Recognising database errors that mean "the live database hasn't been
// updated for this code yet". Migrations are applied by hand after a deploy
// (see CLAUDE.md), so new code has to cope with an old database for a while.

/** P2021: the table doesn't exist yet. */
export function isMissingTable(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2021";
}

/** A value the database's enum type doesn't have yet, e.g. a new plan's app version. */
export function isUnknownEnumValue(e: unknown): boolean {
  return /invalid input value for enum/i.test((e as { message?: string })?.message ?? "");
}
