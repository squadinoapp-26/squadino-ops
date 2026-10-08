import { requirePlatformSessionOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { listPendingRejections } from "@/lib/signupRejection.server";

export const dynamic = "force-dynamic";

export default async function PendingSignupsPage() {
  await requirePlatformSessionOrRedirect();
  // Signups a moderator wants rejected are waiting for an admin, so they leave the "new" list and sit in their own.
  const awaitingRejection = await listPendingRejections();
  const awaitingIds = awaitingRejection.map((r) => r.signupId);
  const [signups, recent, waiting, rejected] = await Promise.all([
    prisma.signupRequest.findMany({
      where: { status: "PENDING", id: { notIn: awaitingIds } },
      orderBy: { createdAt: "asc" },
    }),
    // Kept visible after approval for their requested URL and so the
    // subdomain + setup email can be finished from the club page.
    prisma.signupRequest.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { reviewedByPlatformUser: { select: { name: true } } },
    }),
    prisma.signupRequest.findMany({ where: { id: { in: awaitingIds } }, select: { id: true, clubName: true, packageKey: true, contactName: true } }),
    prisma.signupRequest.findMany({
      where: { status: "REJECTED" },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { reviewedByPlatformUser: { select: { name: true } } },
    }),
  ]);
  const waitingById = new Map(waiting.map((s) => [s.id, s]));

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Pending Signups</h1>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-3">
        {signups.map((s) => (
          <Link
            key={s.id}
            href={`/signups/${s.id}`}
            className="block bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-500 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{s.clubName}</h3>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{s.packageKey}</span>
                </div>
                <p className="text-sm text-slate-500 truncate">
                  {s.contactName} · {s.contactEmail} · ~{s.estimatedUsers} users
                </p>
              </div>
              <div className="text-sm text-slate-500 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString("en-AU")}</div>
            </div>
          </Link>
        ))}
        {signups.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">📥</p>
            <p className="font-medium">No pending signups.</p>
          </div>
        )}

        {awaitingRejection.length > 0 && (
          <div className="pt-6">
            <h2 className="font-bold mb-1">Rejection waiting for an admin</h2>
            <p className="text-xs text-slate-500 mb-3">A moderator has asked for these to be rejected. An admin approves the rejection or re-instates the signup.</p>
            <div className="space-y-2">
              {awaitingRejection.map((r) => {
                const s = waitingById.get(r.signupId);
                if (!s) return null;
                return (
                  <Link
                    key={r.requestId}
                    href={`/signups/${s.id}`}
                    className="block bg-slate-800/60 border border-red-900/60 rounded-xl px-4 py-3 hover:border-slate-500 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.clubName}</span>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{s.packageKey}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{`Reason: ${r.reason}`}</p>
                    <p className="text-xs text-slate-500">{`Asked by ${r.requestedByName} · ${new Date(r.createdAt).toLocaleDateString("en-AU")}`}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {rejected.length > 0 && (
          <div className="pt-6">
            <h2 className="font-bold mb-3">Recently rejected</h2>
            <div className="space-y-2">
              {rejected.map((s) => (
                <Link
                  key={s.id}
                  href={`/signups/${s.id}`}
                  className="block bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 hover:border-slate-500 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{s.clubName}</span>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{s.packageKey}</span>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap text-right">
                      {s.reviewedAt ? new Date(s.reviewedAt).toLocaleDateString("en-AU") : ""}
                      {s.reviewedByPlatformUser && <p>by {s.reviewedByPlatformUser.name}</p>}
                    </div>
                  </div>
                  {s.rejectionReason && <p className="text-xs text-slate-400 mt-1">{`Reason: ${s.rejectionReason}`}</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="pt-6">
            <h2 className="font-bold mb-3">Recently approved</h2>
            <div className="space-y-2">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  href={`/signups/${s.id}`}
                  className="flex items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 hover:border-slate-500 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.clubName}</span>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{s.packageKey}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {s.contactEmail}{s.requestedUrl ? ` · wants ${s.requestedUrl}` : ""}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap text-right">
                    {s.reviewedAt ? new Date(s.reviewedAt).toLocaleDateString("en-AU") : ""}
                    {s.reviewedByPlatformUser && <p>by {s.reviewedByPlatformUser.name}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
