import { describe, it, expect } from "vitest";
import { clientIp, maxAttemptsFor, MAX_ATTEMPTS_PER_EMAIL, MAX_ATTEMPTS_PER_IP } from "./rateLimitRules";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp: the address a visitor cannot choose", () => {
  it("ignores a made-up cf-connecting-ip header (ops is on Vercel, not behind Cloudflare)", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.5", "cf-connecting-ip": "1.1.1.1" }))).toBe("203.0.113.5");
    expect(clientIp(h({ "x-real-ip": "203.0.113.5", "cf-connecting-ip": "1.1.1.1" }))).toBe("203.0.113.5");
  });

  it("a different forged value on every request still counts as the same visitor", () => {
    const seen = new Set<string | null>();
    for (let i = 0; i < 20; i++) seen.add(clientIp(h({ "x-forwarded-for": "203.0.113.5", "cf-connecting-ip": `9.9.9.${i}` })));
    expect([...seen]).toEqual(["203.0.113.5"]);
  });

  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "203.0.113.5" }))).toBe("198.51.100.7");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });

  it("returns null when there is no usable header", () => {
    expect(clientIp(h({}))).toBeNull();
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1" }))).toBeNull();
  });
});

describe("lockout limits per kind of counter", () => {
  it("allows 5 wrong tries per email but 30 per IP address", () => {
    expect(MAX_ATTEMPTS_PER_EMAIL).toBe(5);
    expect(MAX_ATTEMPTS_PER_IP).toBe(30);
    expect(maxAttemptsFor("email:platform:admin@example.com")).toBe(5);
    expect(maxAttemptsFor("ip:203.0.113.5")).toBe(30);
    expect(maxAttemptsFor("something-else")).toBe(5);
  });
});
