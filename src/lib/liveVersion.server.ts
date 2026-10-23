// The answer to "has anything changed in the console?" (see liveRefresh.ts). It reads a few cheap totals, how many rows there are and the
// latest time anything was added or changed, in the tables the console shows, and turns them into one short fingerprint. The fingerprint
// reveals nothing about the data; the page only compares it with the last one it saw. Every change made in the console is also written to
// the Logs, which is why the Logs total alone already moves for nearly everything; the other tables catch what arrives without a Logs line
// (a new signup from the website, a club's request for extra members, a Stripe event).
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";

type Agg = { _count: { _all: number }; _max: Record<string, Date | null> };

// A table the database doesn't have yet (code deployed before its update) just counts as "nothing there".
async function safe(run: () => Promise<Agg>): Promise<Agg | null> {
  try {
    return await run();
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

const part = (agg: Agg | null): string =>
  agg ? `${agg._count._all}:${Object.values(agg._max).map((d) => (d ? d.getTime() : 0)).join(",")}` : "-";

export async function loadLiveVersion(): Promise<string> {
  const aggs = await Promise.all([
    safe(() => prisma.platformAuditLog.aggregate({ _count: { _all: true }, _max: { createdAt: true } })),
    safe(() => prisma.signupRequest.aggregate({ _count: { _all: true }, _max: { createdAt: true, reviewedAt: true } })),
    safe(() => prisma.changeRequest.aggregate({ _count: { _all: true }, _max: { createdAt: true, decidedAt: true } })),
    safe(() => prisma.extraMemberRequest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })),
    safe(() => prisma.fullPackageRequest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })),
    safe(() => prisma.club.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })),
    safe(() => prisma.clubBilling.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })),
    safe(() => prisma.freeDaysGrantClub.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })),
  ]);
  return createHash("sha256").update(aggs.map(part).join("|")).digest("hex").slice(0, 16);
}
