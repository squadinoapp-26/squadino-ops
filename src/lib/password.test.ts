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
    expect(median(burn)).toBeGreaterThan(8);
  });
});
