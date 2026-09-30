import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listSports } from "@/lib/sportCatalog.server";
import { sortSports } from "@/lib/sportCatalog";
import { getPlatformUser, canManageSportsList, requirePlatformSessionOrRedirect } from "@/lib/auth";
import SportsManager from "./SportsManager";

export const dynamic = "force-dynamic";

export default async function PlatformSportsPage() {
  await requirePlatformSessionOrRedirect();
  await listSports(); // fills an empty table with the defaults first
  const [sports, clubs, viewer] = await Promise.all([
    prisma.sport.findMany({ select: { id: true, name: true, icon: true } }),
    prisma.club.findMany({ select: { sport: true, sports: true } }),
    getPlatformUser(),
  ]);

  // How many clubs run each sport, so an admin can see what removing one affects.
  const clubCounts = new Map<string, number>();
  for (const club of clubs) {
    for (const s of new Set(club.sports.length ? club.sports : [club.sport])) {
      clubCounts.set(s, (clubCounts.get(s) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Sports list</h1>
      </div>
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-slate-400 mb-6">
          The sports offered everywhere a sport is picked: website signup, new-club setup, club App Settings and the
          club editor here. Removing a sport only takes it off the list — clubs already running it keep it.
        </p>
        <SportsManager
          sports={sortSports(sports).map((s) => ({ ...s, clubs: clubCounts.get(s.name) ?? 0 }))}
          canManage={canManageSportsList(viewer?.role)}
        />
      </div>
    </div>
  );
}
