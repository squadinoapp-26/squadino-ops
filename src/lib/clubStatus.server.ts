import { prisma } from "@/lib/prisma";

function missingTable(e: unknown): boolean {
  // P2021: "The table does not exist in the current database."
  return (e as { code?: string })?.code === "P2021";
}

/**
 * When each of these clubs was deactivated, keyed by club id. Inactive clubs
 * with no date yet — switched off before this was tracked, or by another
 * tool — are given today's date, so their 12 months start now. Returns null
 * if the table doesn't exist yet (code deployed before `db-sync.cmd`).
 */
export async function getDeactivationDates(clubs: { id: string; active: boolean }[]): Promise<Map<string, Date> | null> {
  const inactive = clubs.filter((c) => !c.active).map((c) => c.id);
  if (inactive.length === 0) return new Map();
  try {
    let rows = await prisma.clubDeactivation.findMany({ where: { clubId: { in: inactive } }, select: { clubId: true, deactivatedAt: true } });
    const missing = inactive.filter((id) => !rows.some((r) => r.clubId === id));
    if (missing.length) {
      await prisma.clubDeactivation.createMany({ data: missing.map((clubId) => ({ clubId })), skipDuplicates: true });
      rows = await prisma.clubDeactivation.findMany({ where: { clubId: { in: inactive } }, select: { clubId: true, deactivatedAt: true } });
    }
    return new Map(rows.map((r) => [r.clubId, r.deactivatedAt]));
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

/**
 * True if nobody has ever signed in to this club — no member has a "last
 * seen" time (recordAccess sets it on every signed-in page load). Such a club
 * can be deleted as soon as it's deactivated.
 */
export async function isClubNeverUsed(clubId: string): Promise<boolean> {
  const used = await prisma.user.findFirst({ where: { clubId, lastSeenAt: { not: null } }, select: { id: true } });
  return !used;
}

/**
 * Switches a club on or off and records (or clears) its deactivation date.
 * The switch itself always happens; if the date can't be recorded because
 * the table isn't there yet, it's filled in later by getDeactivationDates.
 */
export async function setClubActive(clubId: string, active: boolean, actor: { id: string; name: string } | null): Promise<void> {
  await prisma.club.update({ where: { id: clubId }, data: { active } });
  try {
    if (active) {
      await prisma.clubDeactivation.deleteMany({ where: { clubId } });
    } else {
      await prisma.clubDeactivation.upsert({
        where: { clubId },
        create: { clubId, deactivatedById: actor?.id ?? null, deactivatedBy: actor?.name ?? null },
        update: {},
      });
    }
  } catch (e) {
    if (!missingTable(e)) throw e;
    console.error("club_deactivations table missing — run db-sync.cmd; the date will be filled in later.");
  }
}
