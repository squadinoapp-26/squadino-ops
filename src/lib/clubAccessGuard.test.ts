import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// One customer care officer or moderator at a time per club (clubAccess.ts): hiding the buttons on the club page is not enough, so every
// route under /api/clubs/[id] that changes the club must refuse an officer who doesn't hold the club (assertClubAccess, HTTP 423). If this
// fails, a new route was added without that lock: add `assertClubAccess` to it, or, if only admins may call it (admins are never held
// back), check the role with `canManageClubStatus` / `canManageClients` and add the file to ADMIN_ONLY below.
const ROOT = join(process.cwd(), "src", "app", "api", "clubs", "[id]");
const ADMIN_ONLY: Record<string, RegExp> = {
  "status/route.ts": /canManageClubStatus\(/,
};

function routes(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(path).isDirectory()) return name === "access" ? [] : routes(path, rel); // the lock's own routes aren't locked by it
    return name === "route.ts" ? [rel] : [];
  });
}

describe("club routes are behind the one-person-per-club lock", () => {
  const files = routes(ROOT);

  it("finds the club routes", () => {
    expect(files).toEqual(expect.arrayContaining(["route.ts", "billing-action/route.ts", "subdomain/route.ts", "setup-email/route.ts", "status/route.ts"]));
  });

  for (const rel of files) {
    it(`${rel} is locked or admin-only`, () => {
      const text = readFileSync(join(ROOT, rel), "utf8");
      const adminOnly = ADMIN_ONLY[rel];
      if (adminOnly) {
        expect(text).toMatch(adminOnly);
        expect(text).not.toMatch(/canReviewSignups\(/); // a route open to every role needs the lock, not just an admin check
      } else {
        expect(text).toMatch(/assertClubAccess\(/);
      }
    });
  }

  it("the club page itself takes the hold before it reads the club", () => {
    const page = readFileSync(join(process.cwd(), "src", "app", "clubs", "[id]", "page.tsx"), "utf8");
    expect(page.indexOf("acquireClubAccess(")).toBeGreaterThan(-1);
    expect(page.indexOf("acquireClubAccess(")).toBeLessThan(page.indexOf("approvedExtraMembersFor(id)"));
  });
});
