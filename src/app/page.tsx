import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, PLATFORM_ROLE_LABELS, canManageStaff, canManageClients, canManagePackages, canViewLogs, canManageSportsList, canManageRestrictedWords, canManageClubStatus } from "@/lib/auth";
import AppConfigMenu from "@/components/AppConfigMenu";
import { canDeleteClub } from "@/lib/clubStatus";
import { getDeactivationDates } from "@/lib/clubStatus.server";
import { getLiveStatus } from "@/lib/presence";
import { LiveStatusProvider, OnlineNowValue, BusiestClients, ClubOnlineBadge } from "@/components/LiveStatus";
import SignOutButton from "@/components/SignOutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const melbourneDate = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium" });

const VERSION_BADGE: Record<string, string> = {
  PRO: "bg-purple-900 text-purple-300",
  BASIC: "bg-blue-900 text-blue-300",
  FREE: "bg-slate-700 text-slate-400",
};

export default async function OpsDashboard() {
  const staff = await requirePlatformSessionOrRedirect();

  const [clubs, liveStatus, pendingSignups, newestPending] = await Promise.all([
    prisma.club.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    }),
    getLiveStatus(),
    prisma.signupRequest.count({ where: { status: "PENDING" } }),
    // The people waiting longest are shown first, so nobody is left waiting.
    prisma.signupRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, clubName: true, packageKey: true, contactName: true, createdAt: true },
    }),
  ]);

  // Approved clubs whose {slug}.squadino.com isn't live yet: the to-do list after approving a signup, oldest first.
  const awaitingSubdomain = clubs.filter(c => c.active && !c.subdomainReady).reverse();
  // Clubs inactive for 12+ months (or never used), offered to super admins and admins for permanent deletion.
  const deactivations = await getDeactivationDates(clubs);
  const readyToDelete = canManageClubStatus(staff.role)
    ? clubs
        .map(c => ({ ...c, deactivatedAt: deactivations?.get(c.id) ?? null }))
        .filter(c => c.deactivatedAt && canDeleteClub(c))
        .sort((a, b) => a.deactivatedAt!.getTime() - b.deactivatedAt!.getTime())
    : [];

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
          <Link href="/signups" className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            Signups
            {pendingSignups > 0 && <span className="ml-2 rounded-full bg-amber-900 px-2 py-0.5 text-xs font-bold text-amber-300">{pendingSignups}</span>}
          </Link>
          {canManageClients(staff.role) && (
            <Link href="/clubs/new" className="bg-blue-600 hover:bg-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
              + New Client
            </Link>
          )}
          <AppConfigMenu items={[
            ...(canManageSportsList(staff.role) ? [{ href: "/sports", label: "Sports list", desc: "The sports every club can pick from" }] : []),
            ...(canManageRestrictedWords(staff.role) ? [{ href: "/restricted-words", label: "Restricted words", desc: "Words blocked or held for review in every club" }] : []),
            ...(canViewLogs(staff.role) ? [{ href: "/logs", label: "Logs", desc: "Every change made in this portal" }] : []),
            ...(canManageStaff(staff.role) ? [{ href: "/app-management/staff", label: "Manage users", desc: "Who can sign in to this portal" }] : []),
            ...(canManagePackages(staff.role) ? [{ href: "/app-management/packages", label: "Packages", desc: "Plans, prices and user limits" }] : []),
            { href: "/clubs", label: "Manage accounts", desc: "Every club account, with search" },
          ]} />
          <div className="text-right">
            <p className="text-sm font-medium">{staff.name}</p>
            <p className="text-xs text-slate-400">{PLATFORM_ROLE_LABELS[staff.role] ?? staff.role}</p>
          </div>
          <SignOutButton className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors" />
        </div>
      </div>

      <LiveStatusProvider initial={liveStatus}>
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          <div className={`rounded-2xl border p-5 ${pendingSignups > 0 ? "bg-amber-950/40 border-amber-700" : "bg-slate-800 border-slate-700"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">{pendingSignups > 0 ? `${pendingSignups} new signup${pendingSignups === 1 ? "" : "s"} waiting for review` : "No signups waiting"}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingSignups > 0 ? "Check the payment, pick the club’s web address and approve, so they can get started." : "New signups from the website appear here as soon as they come in."}
                </p>
              </div>
              <Link href="/signups" className="bg-amber-600 hover:bg-amber-500 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                {pendingSignups > 0 ? "Review signups →" : "Signups →"}
              </Link>
            </div>
            {newestPending.length > 0 && (
              <ul className="mt-4 divide-y divide-amber-900/60">
                {newestPending.map(s => (
                  <li key={s.id}>
                    <Link href={`/signups/${s.id}`} className="flex items-center justify-between gap-4 py-2.5 hover:text-white">
                      <span className="min-w-0">
                        <span className="text-sm font-medium">{s.clubName}</span>
                        <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{s.packageKey}</span>
                        <span className="block text-xs text-slate-400 truncate">{s.contactName}</span>
                      </span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString("en-AU")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Clubs" value={totals.clubs} />
            <StatCard label="Active Clubs" value={totals.active} />
            <StatCard label="Total Users" value={totals.users} />
            <StatCard label="Logged In Now" value={<OnlineNowValue />} live />
          </div>

          {awaitingSubdomain.length > 0 && (
            <div className="bg-slate-800 border border-amber-800/60 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Subdomains to set up</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Open the club, press &quot;Set up subdomain&quot;, then send the owner their setup email.</p>
                </div>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-amber-900 text-amber-300">{awaitingSubdomain.length}</span>
              </div>
              <ul className="mt-4 divide-y divide-slate-700">
                {awaitingSubdomain.map(club => (
                  <li key={club.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{club.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{club.slug}.squadino.com</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(club.createdAt).toLocaleDateString("en-AU")}</span>
                      <Link href={`/clubs/${club.id}`} className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Set up →</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readyToDelete.length > 0 && (
            <div className="bg-slate-800 border border-red-800/60 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Inactive for over a year</h2>
                  <p className="text-xs text-slate-400 mt-0.5">These clubs have been deactivated for more than 12 months. Open each one to delete it permanently if it&apos;s no longer needed.</p>
                </div>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-900 text-red-300">{readyToDelete.length}</span>
              </div>
              <ul className="mt-4 divide-y divide-slate-700">
                {readyToDelete.map(club => (
                  <li key={club.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{club.name}</p>
                      <p className="text-xs text-slate-400">{`Deactivated ${melbourneDate.format(club.deactivatedAt!)}`}</p>
                    </div>
                    <Link href={`/clubs/${club.id}`} className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Review →</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
