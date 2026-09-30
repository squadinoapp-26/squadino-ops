import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { createPlatformSession } from "@/lib/auth";
import { assertNotRateLimited, clearAttempts, clientIp, emailKey, ipKey, recordFailedAttempt, RateLimitedError } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const emailLc = email.toLowerCase().trim();

  // Same brute-force protection as squadino's /platform login: 5 failures per
  // email or per IP in 15 minutes, counted in the shared login_attempts table.
  const rateLimitKeys = [emailKey(`platform:${emailLc}`), ipKey(clientIp(req.headers))].filter((k): k is string => k !== null);
  try {
    await assertNotRateLimited(rateLimitKeys);
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return NextResponse.json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds }, { status: 429 });
    }
    throw e;
  }

  const user = await prisma.platformUser.findUnique({ where: { email: emailLc } });
  const valid = !!user && user.active && (await verify(user.passwordHash, password).catch(() => false));
  if (!user || !valid) {
    await recordFailedAttempt(rateLimitKeys);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await clearAttempts(rateLimitKeys);

  await createPlatformSession(user.id);
  return NextResponse.json({ ok: true });
}
