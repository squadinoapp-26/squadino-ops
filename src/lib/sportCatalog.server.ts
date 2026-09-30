import { prisma } from "@/lib/prisma";
import { DEFAULT_SPORTS, sortSports, type CatalogSport } from "@/lib/sportCatalog";

/**
 * The sports list every picker offers, alphabetical. An empty table is
 * filled with DEFAULT_SPORTS first — that covers both a fresh migration and
 * a database set up with `prisma db push`, which creates the table but runs
 * no seed. If the table can't be read at all (its migration hasn't run
 * yet), pickers fall back to the defaults rather than breaking.
 */
export async function listSports(): Promise<CatalogSport[]> {
  try {
    let rows = await prisma.sport.findMany({ select: { name: true, icon: true } });
    if (rows.length === 0) {
      await prisma.sport.createMany({ data: DEFAULT_SPORTS, skipDuplicates: true });
      rows = await prisma.sport.findMany({ select: { name: true, icon: true } });
    }
    return sortSports(rows);
  } catch (e) {
    console.error("Couldn't read the sports list — using the built-in defaults.", e);
    return sortSports(DEFAULT_SPORTS);
  }
}

export async function listSportNames(): Promise<string[]> {
  return (await listSports()).map((s) => s.name);
}
