import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canManagePackages, canReviewSignups, canManageClubStatus, canApproveChanges } from "@/lib/auth";
import { ROOT_DOMAIN } from "@/lib/hostClub";
import { vercelDomainsConfigured } from "@/lib/vercelDomains";
import ClubSetupPanel from "./ClubSetupPanel";
import ClubStatusPanel from "./ClubStatusPanel";
import BillingActionsPanel from "./BillingActionsPanel";
import { offerStatusLabel } from "@/lib/holdOffers";
import ClubBillingPanel from "@/components/ClubBillingPanel";
import { isMissingTable } from "@/lib/prismaErrors";
import { canDeleteClub, deletableFrom, monthsBetween } from "@/lib/clubStatus";
import { getDeactivationDates, isClubNeverUsed } from "@/lib/clubStatus.server";
import { presenceFor } from "@/lib/presence";
import { notFound } from "next/navigation";
import Link from "next/link";
import ClubPlanEditor from "./ClubPlanEditor";
import ClubUrlEditor from "./ClubUrlEditor";
import ClubUsersList from "./ClubUsersList";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const melbourneDate = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "long" });

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

  // Admins who have never signed in: for a newly approved signup, the owner still waiting on their setup email.
  const pendingOwners = await prisma.user.findMany({
    where: { clubId: club.id, role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE", lastSeenAt: null },
    select: { email: true },
  });
  const deactivatedAt = (await getDeactivationDates([club]))?.get(club.id) ?? null;
  const neverUsed = await isClubNeverUsed(club.id);
  // What Stripe last said about the subscription; the table may not exist yet (database update not run).
  const billing = await prisma.clubBilling.findUnique({ where: { clubId: club.id } }).catch((e) => {
    if (isMissingTable(e)) return null;
    throw e;
  });
  // Account hold offers sent to the customer (the table may not exist yet).
  const offers = await prisma.holdOffer
    .findMany({ where: { clubId: club.id }, orderBy: { createdAt: "desc" }, take: 4 })
    .catch((e) => {
      if (isMissingTable(e)) return [];
      throw e;
    });
  const needsSetup = club.active && (!club.subdomainReady || pendingOwners.length > 0);

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

        {needsSetup && (
          <ClubSetupPanel
            clubId={club.id}
            host={`${club.slug}.${ROOT_DOMAIN}`}
            subdomainReady={club.subdomainReady}
            pendingOwners={pendingOwners.map((u) => u.email)}
            canManage={canReviewSignups(staff.role)}
            autoSubdomain={vercelDomainsConfigured()}
          />
        )}

        <ClubBillingPanel billing={billing} />

        {club.stripeSubscriptionId && !club.stripeSubscriptionId.startsWith("dummy_") && (
          <BillingActionsPanel
            clubId={club.id}
            clubName={club.name}
            onHold={billing?.packageKey === "hold"}
            cancelling={!!billing?.cancelAtPeriodEnd}
            needsApproval={!canApproveChanges(staff.role)}
            offers={offers.map((o) => ({
              id: o.id,
              kind: o.kind,
              label: offerStatusLabel(o, new Date()),
              sentOn: melbourneDate.format(o.createdAt),
              sentTo: o.sentTo,
            }))}
          />
        )}

        <ClubStatusPanel
          clubId={club.id}
          clubName={club.name}
          active={club.active}
          deactivatedOn={deactivatedAt ? melbourneDate.format(deactivatedAt) : null}
          monthsInactive={deactivatedAt ? monthsBetween(deactivatedAt, new Date()) : null}
          deletableOn={deactivatedAt ? melbourneDate.format(deletableFrom(deactivatedAt)) : null}
          neverUsed={neverUsed}
          canDelete={canDeleteClub({ active: club.active, deactivatedAt, neverUsed })}
          canManage={canManageClubStatus(staff.role)}
        />

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

        <ClubPlanEditor
          clubId={club.id}
          packages={packages.map((p) => ({ id: p.id, name: p.name, userCap: p.userCap, priceCents: p.priceCents, active: p.active }))}
          currentPackageId={club.packageId}
          userCapOverride={club.userCapOverride}
          userCount={club._count.users}
          needsApproval={!canManagePackages(staff.role)}
        />

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
