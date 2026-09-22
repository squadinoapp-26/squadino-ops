import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canManagePackages } from "@/lib/auth";
import { presenceFor } from "@/lib/presence";
import { notFound } from "next/navigation";
import Link from "next/link";
import ClubPlanEditor from "./ClubPlanEditor";
import ClubUrlEditor from "./ClubUrlEditor";
import ClubUsersList from "./ClubUsersList";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function ClubDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const staff = await requirePlatformSessionOrRedirect();
  const { id } = await params;
  const { created } = await searchParams;

  const [club, packages] = await Promise.all([
    prisma.club.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, name: true, email: true, role: true, status: true, createdAt: true, lastSeenAt: true,
            sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { city: true, countryCode: true } },
          },
        },
        _count: { select: { users: true, events: true, news: true } },
      },
    }),
    prisma.package.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!club) notFound();

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <div className="flex items-center gap-3">
          {club.logoUrl && <img src={club.logoUrl} alt={club.name} className="w-8 h-8 rounded-lg object-cover" />}
          <h1 className="font-bold text-lg">{club.name}</h1>
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{club.code}</span>
          <span className="text-xs text-slate-500 font-mono">{club.slug}.squadino.com</span>
        </div>
        <SignOutButton className="ml-auto text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors" />
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {created && (
          <div className="bg-green-900/40 border border-green-700 rounded-2xl p-4 text-sm text-green-200">
            <p className="font-semibold">Client created.</p>
            <p className="mt-1 text-green-300">
              An email has gone out to the owner to set their password. The subdomain{" "}
              <span className="font-mono">{club.slug}.squadino.com</span> is reserved but not live yet — add the DNS
              record + Vercel custom domain, then turn on &quot;Subdomain is live&quot; from squadino&apos;s own
              /platform club editor. Until then the owner signs in at app.squadino.com.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Users" value={club._count.users} />
          <Stat label="Events" value={club._count.events} />
          <Stat label="News Posts" value={club._count.news} />
        </div>

        <ClubUrlEditor
          clubId={club.id}
          initialSlug={club.slug}
          initialSubdomainReady={club.subdomainReady}
          initialCustomDomain={club.customDomain}
        />

        {canManagePackages(staff.role) ? (
          <ClubPlanEditor
            clubId={club.id}
            packages={packages.map((p) => ({ id: p.id, name: p.name, userCap: p.userCap, priceCents: p.priceCents, active: p.active }))}
            currentPackageId={club.packageId}
            userCapOverride={club.userCapOverride}
            userCount={club._count.users}
          />
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Plan: {packages.find((p) => p.id === club.packageId)?.name ?? "No package"}
            </span>
            <span className="font-semibold text-slate-200">
              {club._count.users} / {club.userCapOverride ?? packages.find((p) => p.id === club.packageId)?.userCap ?? "unlimited"} users
              {club.userCapOverride != null && <span className="text-blue-400 font-normal"> (override)</span>}
            </span>
          </div>
        )}

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold mb-4 text-slate-200">Recent Users</h2>
          <ClubUsersList
            users={club.users
              .map(user => ({ user, presence: presenceFor(user.lastSeenAt, user.sessions[0]) }))
              .sort((a, b) => Number(b.presence.online) - Number(a.presence.online))
              .map(({ user, presence: { online, location } }) => ({
                id: user.id, name: user.name, email: user.email, role: user.role, status: user.status,
                online, location,
              }))}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}
