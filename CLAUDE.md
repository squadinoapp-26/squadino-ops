# squadino-ops — project guide for Claude

The **only** admin console for SQUADINO (`ops.squadino.com`, local port 3004). It is a
separate Next.js 16 app and repo (`squadinoapp-26/squadino-ops`) that reads and writes the
SAME production Postgres as the club app (repo `squadinoapp-26/squadinoPRIVATE`, local
`../squadino`). The club app has no admin console any more, on purpose, so nobody can land
on an admin sign-in screen there.

Working agreements, history and the migration plan live in the club repo:
`../squadino/CLAUDE.md` and `../squadino/docs/claude/HANDOFF.md` (read that first). The owner
is not a developer: plain words, ask before product-behaviour decisions.

## What it does

Signups (review, edit, approve, reject) · Set up subdomain (Vercel) · Send setup email ·
Club status (deactivate / reactivate / delete after 12 months) · New Client (by hand) ·
Sports list · Restricted words · Logs · Manage users (staff) · Packages & prices ·
Manage accounts (searchable club list) · dashboard alerts. Roles: SUPER_ADMIN, ADMIN,
MODERATOR, CUSTOMER_CARE — see `src/lib/auth.ts` (`can…` helpers, tested in `roles.test.ts`).

## Rules that must not be broken

1. **Every page must call `requirePlatformSessionOrRedirect()`; every API route must call
   `requirePlatformSession()` / `getPlatformUser()` and check the role.** `src/proxy.ts`
   also checks the session against the database, but pages and routes are the second lock.
2. **Every change made in the console must call `recordAudit` (`src/lib/auditLog.server.ts`).**
   The log is insert-only: never add a way to edit or delete entries.
3. **The Prisma schema here is a mirror.** Never run `db push` / `migrate` from this repo.
   The club app owns the schema: copy its `prisma/schema.prisma` over (keep the header
   comment) and run `node node_modules/prisma/build/index.js generate`.
4. **Some logic is copied from the club app and must stay in step by hand:**
   `src/lib/modules.ts` (plan → modules, from the club app's `src/lib/settings.ts`),
   `src/lib/clubCreate.ts` (club creation), `src/lib/signupPackages.ts` (mirror of
   `Website/src/lib/packages.ts` — `signupPackages.test.ts` has the expected values written
   out; change both together), `hostClub.ts`, `subdomain.ts`, `sportCatalog.ts`,
   `restrictedWordsList.ts`.
5. Staff passwords are at least 12 characters (`src/lib/passwordPolicy.ts`).
6. Keep the console out of search engines and frames (headers in `next.config.ts`,
   `src/app/robots.ts`, `robots` in the layout).

## Commands (Cylance blocks `npx` and `gh.exe` on the owner's PC — call node directly)

- Dev: `npm run dev` (port 3004)
- Types: `node node_modules/typescript/bin/tsc --noEmit`
- Lint: `node node_modules/eslint/bin/eslint.js src` (6 old errors remain in
  `ClubUrlEditor.tsx` and `reset-password/page.tsx`; don't add new ones)
- Tests: `npm test` (vitest; pure logic only — no database tests)
- Build check: `DATABASE_URL=postgresql://u:p@localhost:5432/x node node_modules/next/dist/bin/next build`
- Commits go through a branch and PR; the owner merges.

## Environment (Vercel project `squadino-ops`)

`DATABASE_URL` · `SQUADINO_APP_URL` (default https://app.squadino.com; setup-email links) ·
`RESEND_API_KEY` · `VERCEL_API_TOKEN` · `VERCEL_PROJECT_ID` (**the club app's project**, not
ops — club addresses belong to it) · `VERCEL_TEAM_ID` (if a team) · `ROOT_DOMAIN` (default
squadino.com).

## Still to do

Two-step sign-in (needs a `PlatformUser` column added from the club repo's schema first);
tests only cover pure logic, so approve → subdomain → setup email has only been checked by
hand.
