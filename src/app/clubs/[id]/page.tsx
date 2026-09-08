import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canManagePackages } from "@/lib/auth";
import { presenceFor } from "@/lib/presence";
import { notFound } from "next/navigation";
import Link from "next/link";
import ClubPlanEditor from "./ClubPlanEditor";

export const dynamic = "force-dynamic";

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSessionOrRedirect();
  const { id } = await params;

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
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Users" value={club._count.users} />
          <Stat label="Events" value={club._count.events} />
          <Stat label="News Posts" value={club._count.news} />
        </div>

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
          <div className="space-y-2">
            {club.users
              .map(user => ({ user, presence: presenceFor(user.lastSeenAt, user.sessions[0]) }))
              .sort((a, b) => Number(b.presence.online) - Number(a.presence.online))
              .map(({ user, presence: { online, location } }) => {
              return (
                <div key={user.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold">{user.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium flex items-center justify-end gap-1.5 ${online ? "text-green-400" : "text-slate-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400" : "bg-slate-600"}`} />
                      {online ? "Online" : "Offline"}
                    </span>
                    {location && <p className="text-xs text-slate-500 mt-0.5">{location}</p>}
                  </div>
                  <span className="text-xs text-slate-400">{user.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.status === "ACTIVE" ? "bg-green-900 text-green-300" :
                    user.status === "PENDING" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"
                  }`}>{user.status}</span>
                </div>
              );
            })}
            {club.users.length === 0 && <p className="text-slate-500 text-sm">No users yet.</p>}
          </div>
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
