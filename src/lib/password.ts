import { hash, verify } from "@node-rs/argon2";

const HASH_OPTS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}

// Checking a password against a real hash takes about 25 ms; skipping the check because the account doesn't exist
// takes about 5. That gap would tell a patient visitor which staff emails exist, so a login with nothing to check
// calls this to spend the same time. The hash is made once, with the same settings as real ones. (Same helper as
// the club app's src/lib/password.ts.)
let dummyHash: Promise<string> | null = null;

export async function burnVerifyTime(password: string): Promise<void> {
  dummyHash ??= hashPassword("not-a-real-password");
  await verify(await dummyHash, password).catch(() => false);
}
