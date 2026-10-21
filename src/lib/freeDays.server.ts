// What the Free days screen reads: the clubs staff can choose from, and the free days already given (with what happened for each
// club). Reads only; the work itself is done by the club app (see applyFreeDaysInClubApp in clubBillingApi.server.ts).
import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";
import { isDummyPaymentId } from "@/lib/payment";

export type BillingKind = "stripe" | "trial" | "none";

export interface ClubChoice {
  id: string;
  name: string;
  code: string;
  slug: string;
  active: boolean;
  packageName: string | null;
  members: number;
  /** Active admins with an email address: the people who would be emailed. */
  admins: number;
  billing: BillingKind;
  /** For a club on a free trial: when it ends (ISO). */
  trialEndsAt: string | null;
}

/** How the free days would affect this club's billing, for the list (the club app works it out again when it applies them). */
export function billingKind(club: { stripeSubscriptionId: string | null; trialEndsAt: Date | null }, now: Date): BillingKind {
  if (club.stripeSubscriptionId && !isDummyPaymentId(club.stripeSubscriptionId)) return "stripe";
  if (club.trialEndsAt && club.trialEndsAt.getTime() > now.getTime()) return "trial";
  return "none";
}

export async function loadClubChoices(): Promise<ClubChoice[]> {
  const now = new Date();
  const [clubs, admins] = await Promise.all([
    prisma.club.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, code: true, slug: true, active: true, stripeSubscriptionId: true, trialEndsAt: true,
        package: { select: { name: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.user.groupBy({ by: ["clubId"], where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE", email: { contains: "@" } }, _count: { _all: true } }),
  ]);
  const adminCount = new Map(admins.map((a) => [a.clubId, a._count._all]));
  return clubs.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    slug: c.slug,
    active: c.active,
    packageName: c.package?.name ?? null,
    members: c._count.users,
    admins: adminCount.get(c.id) ?? 0,
    billing: billingKind(c, now),
    trialEndsAt: c.trialEndsAt ? c.trialEndsAt.toISOString() : null,
  }));
}

export interface GrantClubRow {
  clubName: string;
  status: string;
  effect: string | null;
  error: string | null;
  oldDate: Date | null;
  newDate: Date | null;
  emailedTo: string[];
  emailedAt: Date | null;
  emailError: string | null;
}

export interface GrantView {
  id: string;
  title: string;
  createdAt: Date;
  approvedByName: string;
  approvedByRole: string;
  freeDates: string[];
  dayCount: number;
  clubs: GrantClubRow[];
  /** Something is still to do: a club not reached, one that failed, or an email still to send. */
  needsFinishing: boolean;
}

/** The latest free days given, newest first; `missing` when the database update hasn't been run. */
export async function loadGrants(limit = 15): Promise<{ missing: boolean; grants: GrantView[] }> {
  try {
    const rows = await prisma.freeDaysGrant.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        clubs: {
          orderBy: { clubName: "asc" },
          select: { clubName: true, status: true, effect: true, error: true, oldDate: true, newDate: true, emailedTo: true, emailedAt: true, emailError: true },
        },
      },
    });
    return {
      missing: false,
      grants: rows.map((g) => ({
        id: g.id,
        title: g.title,
        createdAt: g.createdAt,
        approvedByName: g.approvedByName,
        approvedByRole: g.approvedByRole,
        freeDates: g.freeDates,
        dayCount: g.dayCount,
        clubs: g.clubs,
        needsFinishing: g.clubs.some((c) => c.status !== "APPLIED" || !c.emailedAt),
      })),
    };
  } catch (e) {
    if (isMissingTable(e)) return { missing: true, grants: [] };
    throw e;
  }
}

/** One grant by the key it was made with, for answering an admin who has just made one directly. */
export async function grantCountsByKey(key: string): Promise<{ id: string; total: number; applied: number; failed: number; emailed: number } | null> {
  const g = await prisma.freeDaysGrant.findUnique({ where: { key }, include: { clubs: { select: { status: true, emailedAt: true } } } });
  if (!g) return null;
  return {
    id: g.id,
    total: g.clubs.length,
    applied: g.clubs.filter((c) => c.status === "APPLIED").length,
    failed: g.clubs.filter((c) => c.status === "FAILED").length,
    emailed: g.clubs.filter((c) => c.emailedAt).length,
  };
}
