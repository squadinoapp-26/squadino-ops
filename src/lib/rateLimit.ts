// DB-backed brute-force protection for auth endpoints (login, PIN login,
// password-reset requests). No external infra (Redis etc.) is configured for
// this project, and the app already holds a persistent Postgres connection,
// so LoginAttempt rows are the simplest reliable store across serverless
// invocations.

import { prisma } from "@/lib/prisma";
import { clientIp, maxAttemptsFor } from "@/lib/rateLimitRules";

export { clientIp };

const WINDOW_MS = 15 * 60 * 1000;

export class RateLimitedError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many attempts. Please try again later.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Throws RateLimitedError if any identifier has hit the attempt cap within
// the window. Call before doing any password/PIN comparison work.
//
// retryAfterSeconds counts down to when the *oldest* attempt inside the
// window ages out (not a flat WINDOW_MS) — that's the moment the count drops
// back under the cap, so the countdown the client shows is accurate rather
// than always showing the full window length.
export async function assertNotRateLimited(identifiers: string[]): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  for (const identifier of identifiers) {
    const max = maxAttemptsFor(identifier);
    const attempts = await prisma.loginAttempt.findMany({
      where: { identifier, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: max,
      select: { createdAt: true },
    });
    if (attempts.length >= max) {
      const retryAfterMs = attempts[0].createdAt.getTime() + WINDOW_MS - Date.now();
      throw new RateLimitedError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
    }
  }
}

export async function recordFailedAttempt(identifiers: string[]): Promise<void> {
  await prisma.loginAttempt.createMany({ data: identifiers.map((identifier) => ({ identifier })) });
}

// Called on successful auth so a genuine user isn't stuck behind stale
// failed-attempt rows from earlier typos.
export async function clearAttempts(identifiers: string[]): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers } } });
}

export function emailKey(email: string): string {
  return `email:${email}`;
}

export function ipKey(ip: string | null): string | null {
  return ip ? `ip:${ip}` : null;
}
