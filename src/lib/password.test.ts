import { describe, expect, it } from "vitest";
import { burnVerifyTime, hashPassword, verifyPassword } from "./password";

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function timeMs(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

describe("burnVerifyTime", () => {
  it("resolves, whatever it is given", async () => {
    await expect(burnVerifyTime("anything")).resolves.toBeUndefined();
    await expect(burnVerifyTime("")).resolves.toBeUndefined();
  });

  it("takes about as long as checking against a real hash, so a missing account can't be told apart by time", async () => {
    const real = await hashPassword("some password");
    await burnVerifyTime("warm up");
    await verifyPassword(real, "warm up");
    const burn: number[] = [];
    const check: number[] = [];
    for (let i = 0; i < 7; i++) {
      burn.push(await timeMs(() => burnVerifyTime("guess")));
      check.push(await timeMs(() => verifyPassword(real, "guess")));
    }
    expect(median(burn)).toBeGreaterThan(median(check) * 0.5);
    expect(median(burn)).toBeLessThan(median(check) * 2);
    // That is also what proves it is real work and not a shortcut: the real check is argon2, so something within
    // a factor of two of it is argon2 too. There is deliberately NO fixed number of milliseconds here: a check
    // takes about 25 ms on the owner's PC but only about 4 ms on a fast machine, and an earlier version that
    // demanded more than 8 ms failed there at random (found in the club app's CI on 2026-10-14).
  });
});
