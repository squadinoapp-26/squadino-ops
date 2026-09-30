import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Importing @/lib/auth builds a Prisma client; the adapter only connects on the first query.
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
});
