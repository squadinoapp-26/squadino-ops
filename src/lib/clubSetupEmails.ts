import { prisma } from "@/lib/prisma";
import { sendEmail, welcomeEmail, subdomainLiveEmail, squadinoAppUrl } from "@/lib/email";
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset.server";
import { clubSubdomainUrl } from "@/lib/hostClub";

type ClubRef = { id: string; name: string; code: string; slug: string; subdomainReady: boolean };

// A club's admins: the owner created at approval is an ADMIN.
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

/** Where a club's members sign in: its own subdomain once it's live, otherwise the shared app. */
export function clubBaseUrl(club: Pick<ClubRef, "slug" | "subdomainReady">): string {
  return club.subdomainReady ? clubSubdomainUrl(club.slug, "") : squadinoAppUrl();
}

/**
 * Sends the setup email — a one-time "set your password" link — to every
 * active admin of the club who has never signed in. For a newly approved
 * signup that's exactly the owner; anyone who has already signed in has a
 * password and doesn't need one. Links point at the club's subdomain once
 * it's live. Returns who it went to.
 */
export async function sendOwnerSetupEmails(club: ClubRef): Promise<string[]> {
  const owners = await prisma.user.findMany({
    where: { clubId: club.id, role: { in: [...ADMIN_ROLES] }, status: "ACTIVE", lastSeenAt: null },
    select: { email: true },
  });
  const base = clubBaseUrl(club);
  for (const { email } of owners) {
    const token = await createResetToken(email);
    const msg = welcomeEmail(`${base}/reset-password?token=${token}`, club.name, RESET_TOKEN_TTL_MINUTES, {
      signInUrl: `${base}/login`,
      inviteUrl: `${base}/register?code=${encodeURIComponent(club.code)}`,
    });
    await sendEmail({ ...msg, to: email });
  }
  return owners.map((o) => o.email);
}

/**
 * Tells a club's admins its own subdomain is live. Only admins who have
 * already signed in — an owner still waiting on their setup email gets the
 * new address in that email instead of a second, confusing one.
 */
export async function sendSubdomainLiveEmails(club: Pick<ClubRef, "id" | "name" | "slug">): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { clubId: club.id, role: { in: [...ADMIN_ROLES] }, status: "ACTIVE", lastSeenAt: { not: null } },
    select: { email: true },
  });
  const msg = subdomainLiveEmail(club.name, clubSubdomainUrl(club.slug, "/login"));
  await Promise.all(admins.map((a) => sendEmail({ ...msg, to: a.email })));
}
