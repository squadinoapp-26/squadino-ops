// DB-backed brute-force protection for auth endpoints (login, PIN login,
// password-reset requests). No external infra (Redis etc.) is configured for
// this project, and the app already holds a persistent Postgres connection,
// so LoginAttempt rows are the simplest reliable store across serverless
// invocations.

import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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
    const attempts = await prisma.loginAttempt.findMany({
      where: { identifier, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_ATTEMPTS,
      select: { createdAt: true },
    });
    if (attempts.length >= MAX_ATTEMPTS) {
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

// x-forwarded-for can be a comma-separated chain; the first entry is the original client.
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return null;
}
