import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/hostClub";
import { requirePlatformSessionOrRedirect, canManageClients } from "@/lib/auth";
import { CLUB_ACCOUNT_FILTERS, filterClubAccounts, isClubAccountFilter } from "@/lib/clubAccounts";

export const dynamic = "force-dynamic";

// Manage accounts (under App Config): every club, searchable, each opening
// its club page. This list used to sit at the bottom of the dashboard.
export default async function ClubAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const staff = await requirePlatformSessionOrRedirect();
  const { q = "", filter: filterParam } = await searchParams;
  const filter = isClubAccountFilter(filterParam) ? filterParam : "all";
  const allClubs = await prisma.club.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });
  const clubs = filterClubAccounts(allClubs, q, filter);
  const href = (f: string) => `/clubs?${new URLSearchParams({ ...(q && { q }), ...(f !== "all" && { filter: f }) })}`;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Manage accounts</h1>
        {canManageClients(staff.role) && (
        <Link href="/clubs/new"
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          + New Club
        </Link>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <form action="/clubs" className="flex flex-wrap items-center gap-3">
          <input name="q" defaultValue={q} aria-label="Search clubs" placeholder="Search by name, code or web address…"
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-xl">Search</button>
          <div className="flex flex-wrap gap-2 ml-auto">
            {Object.entries(CLUB_ACCOUNT_FILTERS).map(([key, label]) => (
              <Link key={key} href={href(key)}
                className={`text-xs px-3 py-1.5 rounded-full border ${filter === key ? "bg-slate-200 text-slate-900 border-slate-200" : "border-slate-700 text-slate-400 hover:text-white"}`}>
                {label}
              </Link>
            ))}
          </div>
        </form>

        <p className="text-xs text-slate-500">{`${clubs.length} of ${allClubs.length} clubs`}</p>

        <div className="space-y-3">
          {clubs.map(club => (
            <div key={club.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
              {club.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={club.logoUrl} alt={club.name} className="w-12 h-12 rounded-xl object-cover" />
                : <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center text-lg font-bold">{club.name.charAt(0)}</div>}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{club.name}</h3>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{club.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    club.appVersion === "PRO" ? "bg-purple-900 text-purple-300" :
                    club.appVersion === "BASIC" ? "bg-blue-900 text-blue-300" :
                    club.appVersion === "COACH" ? "bg-teal-900 text-teal-300" : "bg-slate-700 text-slate-500"
                  }`}>{club.appVersion}</span>
                  {!club.active && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Inactive</span>}
                  {club.subdomainReady
                    ? <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Subdomain live</span>
                    : <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">Subdomain not ready</span>}
                </div>
                <p className="text-sm text-slate-500">
                  {`${club.sport} · ${club._count.users} users · `}
                  {club.subdomainReady
                    ? <a href={`https://${club.slug}.${ROOT_DOMAIN}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{`${club.slug}.${ROOT_DOMAIN}`}</a>
                    : <span className="font-mono">{`${club.slug}.${ROOT_DOMAIN}`}</span>}
                  {club.customDomain && <>{" · "}<span className="font-mono">{club.customDomain}</span></>}
                </p>
              </div>
              <div className="text-sm text-slate-500">{new Date(club.createdAt).toLocaleDateString("en-AU")}</div>
              <Link href={`/clubs/${club.id}`}
                className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                Manage →
              </Link>
            </div>
          ))}
          {clubs.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">🏟️</p>
              <p className="font-medium">{allClubs.length === 0 ? "No clubs yet. Create the first one." : "No clubs match."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
