import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const HASH_OPTS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

async function main() {
  // First platform (company) staff account — only created if none exist, so
  // this never resets a real super admin's password on re-seed.
  const anyPlatformUser = await prisma.platformUser.findFirst();
  if (!anyPlatformUser) {
    const email = process.env.SEED_OWNER_EMAIL ?? "naweenmalwatta@gmail.com";
    const password = process.env.SEED_OWNER_PASSWORD;
    if (!password) {
      throw new Error("Set SEED_OWNER_PASSWORD (and optionally SEED_OWNER_EMAIL) before seeding — this is production, no default password.");
    }
    await prisma.platformUser.create({
      data: {
        name: "Naween Malwatta",
        email,
        passwordHash: await hash(password, HASH_OPTS),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✓ Platform super admin created: ${email}`);
  } else {
    console.log("Platform user(s) already exist — skipping.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
