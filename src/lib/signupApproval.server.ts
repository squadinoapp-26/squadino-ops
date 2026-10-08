import { prisma } from "@/lib/prisma";
import { provisionSignup } from "@/lib/signupProvisioning";
import { recordAudit } from "@/lib/auditLog.server";
import { normaliseSubdomain, subdomainProblem } from "@/lib/subdomain";
import { ROOT_DOMAIN } from "@/lib/hostClub";
import { ChangeError } from "@/lib/changeError";

type Actor = { id: string; name: string; role: string };

/**
 * The club's {slug}.squadino.com, chosen by whoever approves so a long club name doesn't become a long web
 * address. Checked here rather than left to createClub, which would quietly add a number to a taken one.
 * Returns the tidied slug, or undefined when none was given (the club name is used then).
 */
export async function checkWebAddress(input: unknown): Promise<string | undefined> {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const slug = normaliseSubdomain(input);
  const problem = subdomainProblem(slug);
  if (problem) throw new ChangeError(problem, 400);
  if (await prisma.club.findUnique({ where: { slug }, select: { id: true } })) {
    throw new ChangeError(`${slug}.${ROOT_DOMAIN} is already taken — pick another web address.`, 409);
  }
  return slug;
}

/**
 * Step 1 of setting a new client up: the signup has been checked (and, for a paid plan, its payment in
 * Stripe), so the Club and its owner account are created and the signup is marked approved by `actor`.
 * Nothing is emailed yet: the web address and the owner's setup email are done from /clubs/[id].
 *
 * Used when an admin approves straight away and when an admin approves a moderator's pre-approval, so the
 * club is made one way only. `note` goes into the Logs entry (the reason, and who pre-approved it).
 */
export async function approveSignup(input: {
  signupId: string;
  slug?: string;
  paymentChecked: boolean;
  actor: Actor;
  note: string | null;
}): Promise<{ clubId: string; clubCode: string }> {
  const signup = await prisma.signupRequest.findUnique({ where: { id: input.signupId } });
  if (!signup) throw new ChangeError("Signup request not found", 404);
  if (signup.status !== "PENDING") throw new ChangeError("Already reviewed", 409);

  // A paid plan has a payment behind it; whoever approves must confirm it was checked before a club is created.
  if (signup.stripeCustomerId && !input.paymentChecked) {
    throw new ChangeError("Confirm you've checked this signup's payment first.", 400);
  }

  const slug = await checkWebAddress(input.slug);
  const result = await provisionSignup(signup, slug);
  if (!result.ok) throw new ChangeError(result.error, result.status);

  await prisma.signupRequest.update({
    where: { id: input.signupId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedByPlatformUserId: input.actor.id },
  });
  await recordAudit(input.actor, {
    action: "signup.approve",
    targetType: "signup",
    targetId: input.signupId,
    targetLabel: signup.clubName,
    note: [`Created club ${result.club.name} (${result.club.code}) at ${result.club.slug}.${ROOT_DOMAIN}`, input.note].filter(Boolean).join(" · "),
  });
  return { clubId: result.club.id, clubCode: result.club.code };
}
