// Blocks a password reset/change from reusing a password the identity (by
// email — the same table also backs squadino's own club-member password
// history, since password_history is keyed by plain email, not a table FK)
// has set before. Checked right before a new password is written; the
// outgoing hash is then recorded so it, too, is blocked from reuse going
// forward. Kept in sync with squadino's src/lib/passwordHistory.ts.
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

// `currentHashes` are the live passwordHash values for this identity's
// account(s) right now — checked alongside history since the current
// password hasn't been written to PasswordHistory yet.
export async function wasPasswordUsed(
  email: string,
  candidatePassword: string,
  currentHashes: string[],
): Promise<boolean> {
  const history = await prisma.passwordHistory.findMany({
    where: { email },
    select: { passwordHash: true },
  });
  const hashes = [...new Set([...currentHashes, ...history.map((h) => h.passwordHash)])];
  for (const hash of hashes) {
    if (await verifyPassword(hash, candidatePassword)) return true;
  }
  return false;
}

// Call once per distinct outgoing hash, before it's overwritten.
export async function recordPasswordHistory(email: string, oldPasswordHash: string): Promise<void> {
  await prisma.passwordHistory.create({ data: { email, passwordHash: oldPasswordHash } });
}
