// The limits and the "which address is this visitor" rule behind the sign-in lockout. Pure, so they can be tested.
// Kept identical to the club app's src/lib/rateLimitRules.ts and clientIp in src/lib/geoip.ts (both apps share
// the login_attempts table, so the `ip:` counters must mean the same thing in both).

// One account (an email address) allows 5 wrong tries in 15 minutes. One IP address allows 30, because many
// people can share an address (a school, a club house), yet one machine is still stopped from trying a common
// password across many accounts.
export const MAX_ATTEMPTS_PER_EMAIL = 5;
export const MAX_ATTEMPTS_PER_IP = 30;

export function maxAttemptsFor(identifier: string): number {
  return identifier.startsWith("ip:") ? MAX_ATTEMPTS_PER_IP : MAX_ATTEMPTS_PER_EMAIL;
}

// The visitor's address, which the lockout counts, so it must be one the visitor cannot choose. Vercel replaces
// x-real-ip and x-forwarded-for with the true address on every request. Do NOT read cf-connecting-ip: it is only
// trustworthy behind Cloudflare, and this site goes straight to Vercel, so anyone could send it with a made-up
// value and dodge the per-IP lockout. x-forwarded-for can be a comma-separated chain; the first entry is the client.
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return null;
}
