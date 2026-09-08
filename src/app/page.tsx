import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, PLATFORM_ROLE_LABELS, canManageStaff } from "@/lib/auth";
import { getLiveStatus } from "@/lib/presence";
import { LiveStatusProvider, OnlineNowValue, BusiestClients, ClubOnlineBadge } from "@/components/LiveStatus";
import Link from "next/link";

export const dynamic = "force-dynamic";

const VERSION_BADGE: Record<string, string> = {
  PRO: "bg-purple-900 text-purple-300",
  BASIC: "bg-blue-900 text-blue-300",
  FREE: "bg-slate-700 text-slate-400",
};

export default async function OpsDashboard() {
  const staff = await requirePlatformSessionOrRedirect();

  const [clubs, liveStatus] = await Promise.all([
    prisma.club.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    }),
    getLiveStatus(),
  ]);

  const totals = {
    clubs: clubs.length,
    active: clubs.filter(c => c.active).length,
    users: clubs.reduce((sum, c) => sum + c._count.users, 0),
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="font-bold text-lg">SQUADINO Ops</h1>
            <p className="text-xs text-slate-400">Management Console</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {canManageStaff(staff.role) && (
            <Link href="/app-management" className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              App Management
            </Link>
          )}
          <div className="text-right">
            <p className="text-sm font-medium">{staff.name}</p>
            <p className="text-xs text-slate-400">{PLATFORM_ROLE_LABELS[staff.role] ?? staff.role}</p>
          </div>
          <form action="/api/logout" method="POST">
            <button className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <LiveStatusProvider initial={liveStatus}>
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Clubs" value={totals.clubs} />
            <StatCard label="Active Clubs" value={totals.active} />
            <StatCard label="Total Users" value={totals.users} />
            <StatCard label="Logged In Now" value={<OnlineNowValue />} live />
          </div>

          <div>
            <h2 className="text-lg font-bold mb-3">Busiest Clients</h2>
            <BusiestClients />
          </div>

          <h2 className="text-lg font-bold">All Clubs</h2>

          <div className="space-y-3">
            {clubs.map(club => (
              <div key={club.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
                {club.logoUrl
                  ? <img src={club.logoUrl} alt={club.name} className="w-12 h-12 rounded-xl object-cover" />
                  : <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center text-lg font-bold">{club.name.charAt(0)}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{club.name}</h3>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{club.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VERSION_BADGE[club.appVersion] ?? "bg-slate-700 text-slate-400"}`}>
                      {club.appVersion}
                    </span>
                    {!club.active && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-sm text-slate-400">{club.sport} · {club._count.users} users · /{club.slug}</p>
                  <div className="mt-1"><ClubOnlineBadge clubId={club.id} /></div>
                </div>
                <div className="text-sm text-slate-400">{new Date(club.createdAt).toLocaleDateString("en-AU")}</div>
                <Link href={`/clubs/${club.id}`}
                  className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                  Manage →
                </Link>
              </div>
            ))}
            {clubs.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <p className="text-4xl mb-3">🏟️</p>
                <p className="font-medium">No clubs yet.</p>
              </div>
            )}
          </div>
        </div>
      </LiveStatusProvider>
    </div>
  );
}

function StatCard({ label, value, live }: { label: string; value: React.ReactNode; live?: boolean }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <p className="text-slate-400 text-sm flex items-center gap-1.5">
        {label}
        {live && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      </p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
