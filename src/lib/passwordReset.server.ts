import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";

// How long a reset link stays valid. Short enough to limit the window if the
// mailbox is later compromised, long enough to survive a slow inbox.
const TTL_MINUTES = 60;

export const RESET_TOKEN_TTL_MINUTES = TTL_MINUTES;

// The "set your password" link in the welcome email lasts a day (owner, 2026-10-17): a new owner often doesn't open
// that email until later. It is still single use and the old ones are voided when a new one is sent. Only
// "Forgot password" keeps the short lifetime above.
export const SETUP_LINK_TTL_MINUTES = 24 * 60;

// The raw token goes in the emailed link; only this hash is stored.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a reset token for an email address.
 *
 * Any earlier unused tokens for that address are invalidated first, so a
 * forwarded or resent link can't be replayed after a newer one is requested.
 * Returns the raw token — the only time it exists in plaintext.
 */
export async function createResetToken(email: string, ttlMinutes: number = TTL_MINUTES): Promise<string> {
  await prisma.passwordResetToken.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return token;
}

/** Looks up a token without consuming it — used to validate the reset form. */
export async function findValidResetToken(token: string) {
  if (!token || typeof token !== "string") return null;

  // Looked up by hash, so the match is exact. The token is 32 random bytes,
  // so guessing it isn't feasible and no constant-time compare is needed here.
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, email: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;

  return row;
}

/** Marks a token used so the link can't be replayed. */
export async function consumeResetToken(id: string) {
  await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}
