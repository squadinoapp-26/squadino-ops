import { prisma } from "./prisma";

// A member counts as "online now" if their app was active this recently.
// A merely-unexpired Session can be days old (SESSION_TTL_HOURS), so
// User.lastSeenAt (bumped on each page load in the club app) is the real
// presence signal.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface ClubOnlineCount {
  clubId: string;
  name: string;
  online: number;
}

export interface LiveStatus {
  totalOnline: number;
  busiest: ClubOnlineCount[]; // top 5 by online count, online > 0 only
  perClub: Record<string, number>;
}

export async function getLiveStatus(): Promise<LiveStatus> {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const grouped = await prisma.user.groupBy({
    by: ["clubId"],
    where: { lastSeenAt: { gte: cutoff } },
    _count: { _all: true },
  });
  if (grouped.length === 0) return { totalOnline: 0, busiest: [], perClub: {} };

  const clubs = await prisma.club.findMany({
    where: { id: { in: grouped.map((g) => g.clubId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(clubs.map((c) => [c.id, c.name]));

  const counts: ClubOnlineCount[] = grouped
    .map((g) => ({ clubId: g.clubId, name: nameById.get(g.clubId) ?? "Unknown", online: g._count._all }))
    .sort((a, b) => b.online - a.online);

  const perClub = Object.fromEntries(counts.map((c) => [c.clubId, c.online]));
  const totalOnline = counts.reduce((sum, c) => sum + c.online, 0);

  return { totalOnline, busiest: counts.slice(0, 5), perClub };
}

// A single user's live online/location status, for a club-detail user row.
export interface UserPresence {
  online: boolean;
  location: string | null; // "City-CC", or null if unknown
}

export function presenceFor(
  lastSeenAt: Date | null,
  latestSession: { city: string | null; countryCode: string | null } | null | undefined,
): UserPresence {
  const online = !!lastSeenAt && lastSeenAt.getTime() >= Date.now() - ONLINE_WINDOW_MS;
  const location = latestSession?.city && latestSession?.countryCode
    ? `${latestSession.city}-${latestSession.countryCode}`
    : (latestSession?.countryCode ?? null);
  return { online, location };
}
