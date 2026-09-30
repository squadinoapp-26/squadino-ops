// A club's lifecycle in the platform console: clubs are deactivated rather
// than deleted, and can only be deleted for good once they've been inactive
// for DELETE_AFTER_MONTHS — or straight after deactivating if nobody ever
// used them (test clubs, abandoned signups). Pure, so the rules are
// unit-tested and shared by the club page, the dashboard prompt and the
// DELETE route.

export const DELETE_AFTER_MONTHS = 12;

/** The date a club deactivated on `deactivatedAt` can first be deleted. */
export function deletableFrom(deactivatedAt: Date): Date {
  const d = new Date(deactivatedAt);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + DELETE_AFTER_MONTHS);
  // 29 Feb + 12 months would roll into March; stay on the month's last day.
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

/**
 * Whether a club can be deleted permanently now. It must be inactive, and
 * either nobody has ever signed in to it (`neverUsed`), or it has a recorded
 * deactivation date at least DELETE_AFTER_MONTHS ago. No date (e.g. the
 * database update hasn't run yet) means a used club has to wait.
 */
export function canDeleteClub(
  club: { active: boolean; deactivatedAt: Date | null; neverUsed?: boolean },
  now = new Date(),
): boolean {
  if (club.active) return false;
  if (club.neverUsed) return true;
  return !!club.deactivatedAt && now >= deletableFrom(club.deactivatedAt);
}

/** Whole calendar months between two dates, for "inactive for 3 months". */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
