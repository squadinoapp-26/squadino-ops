import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    // Time limits, so a database that accepts connections but never answers turns into an error instead of every
    // request hanging for good. Client-side timers on purpose: statement_timeout goes to the server as a startup
    // setting, which Neon's connection pooler can refuse. Same values and overrides as the club app's src/lib/prisma.ts
    // (where 5 s was tested and found too tight: the connection timeout also caps the wait for a free pooled connection).
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 15_000, // wait for a free (or new) connection
    query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS) || 30_000, // give up on any single query after this long
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
