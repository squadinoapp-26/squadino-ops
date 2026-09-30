import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createClub } from "@/lib/clubCreate";
import { createGeneralChatGroup } from "@/lib/clubProvisioning";
import { hashPassword } from "@/lib/password";
import { getSignupPackage } from "@/lib/signupPackages";
import type { SignupRequest } from "@/generated/prisma/client";

type ProvisionResult =
  | { ok: true; club: { id: string; name: string; code: string; slug: string } }
  | { ok: false; error: string; status: number };

/**
 * Turns an approved SignupRequest into a real Club + owner ADMIN user + the
 * club's general chat. The owner gets a random, never-communicated password:
 * they set their real one from the setup email a platform admin sends once
 * the club's subdomain is ready (see sendOwnerSetupEmails in
 * src/lib/clubSetupEmails.ts) — which also proves they own the email.
 *
 * The club starts with subdomainReady=false (the schema default); the
 * admin sets that up from /clubs/[id]. `slug` is the subdomain the
 * approving admin picked; without it the club name is used, as before.
 *
 * Does NOT touch the SignupRequest's status or send any email.
 */
export async function provisionSignup(signup: SignupRequest, slug?: string): Promise<ProvisionResult> {
  const trialEndsAt = signup.trialDays
    ? new Date(Date.now() + signup.trialDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const result = await createClub({
    name: signup.clubName,
    slug,
    sports: signup.sports,
    orgType: signup.orgType,
    // The package decides the plan. A Coach signup that arrived before the
    // live database knew COACH was stored as BASIC (see /api/signup-requests).
    appVersion: getSignupPackage(signup.packageKey)?.appVersion ?? signup.appVersion,
    street: signup.street ?? undefined,
    suburb: signup.suburb ?? undefined,
    postcode: signup.postcode ?? undefined,
    stripeCustomerId: signup.stripeCustomerId ?? undefined,
    stripeSubscriptionId: signup.stripeSubscriptionId ?? undefined,
    trialEndsAt,
  });
  if (!result.ok) return result;
  const club = result.club;

  try {
    const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
    const owner = await prisma.user.create({
      data: { clubId: club.id, name: signup.contactName, email: signup.contactEmail, passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    await createGeneralChatGroup(club.id, owner.id);
  } catch {
    // Never leave an orphaned, un-ownable club behind.
    await prisma.club.delete({ where: { id: club.id } }).catch(() => {});
    return { ok: false, error: "Could not create the owner account", status: 500 };
  }

  return { ok: true, club: { id: club.id, name: club.name, code: club.code, slug: club.slug } };
}
