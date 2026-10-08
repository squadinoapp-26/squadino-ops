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

Signups (review, edit, approve, reject with a reason an admin must confirm) · Set up subdomain (Vercel) · Send setup email ·
Club status (deactivate / reactivate / delete after 12 months) · New Client (by hand) ·
Sports list · Restricted words · Logs · Manage users (staff) · Packages & prices ·
Manage accounts (searchable club list) · dashboard alerts · each club's Stripe billing status
(plan, cancelling, payment failed) — written by the club app's `/api/billing/sync` into the
`club_billing` table, read-only here. Roles: SUPER_ADMIN, ADMIN,
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
5. **Sensitive changes need an admin.** Plan / user-limit changes, billing actions (account hold,
   resume, cancel) and package prices go through `submitChange` in
   `src/lib/changeRequests.server.ts`: SUPER_ADMIN and ADMIN make them directly, everyone else creates
   a `ChangeRequest` that an admin approves at `/approvals` (`decideChange`). Never write to the
   club's plan, user cap or a package, or call the club app's billing API, from a route without
   going through it. Role helpers: `canApproveChanges`, `canManagePackages` (`src/lib/auth.ts`).
   **Approving or rejecting a new signup is a two-step process** (owner's rules, 2026-10-08 and 2026-10-09; types
   `SIGNUP_PREAPPROVE` and `SIGNUP_REJECT`; no schema change, they reuse `change_requests`, whose `type` is a plain
   string):
   - A moderator or customer care officer checks the signup (and, on a paid plan, its payment in Stripe, a tick
     they must confirm) and **pre-approves** it with optional notes (`POST /api/signups/[id]/approve`), or asks for it to be
     **rejected** with a reason that is required (`POST /api/signups/[id]/reject`). Neither changes the signup yet: both are
     requests an admin decides. While one waits the signup stays PENDING in the database but is left out of the "new
     signups" list and count (`listPendingSignupRequests` in `src/lib/signupReview.server.ts`) and can't be approved or
     rejected again.
   - Super admins and admins can do the same straight away, but **an admin always gives a written reason**, whichever way
     they decide: approving, rejecting, approving or turning down a moderator's request (`decisionNoteRequired` in
     `changeRequests.ts`, enforced in `decideChange` and the routes), and re-instating a rejected signup.
   - Final approval of a pre-approval runs `approveSignup` (`src/lib/signupApproval.server.ts`, the one place a club is
     created from a signup); the admin may change the web address. "Send back" returns the signup to the review list.
     For a rejection request, "Approve rejection" makes it REJECTED with the reason and "Re-instate" turns the request
     down. The admin-only dashboard boxes are **Pre-approved clubs** and **Rejected clubs**; an already-rejected signup
     can be re-instated there or on its page (`POST /api/signups/[id]/reinstate`).
   - **Everything is recorded with the person's name and role, and nothing can be deleted.** Each step writes a Logs
     entry on the signup itself (`signup.preapprove`, `signup.reject_requested`, `signup.approve`, `signup.reject`,
     `signup.preapprove_declined`, `signup.reinstate`), and the signup page shows them to all staff as "Review history".
     See rule 7.
6. Staff passwords are at least 12 characters (`src/lib/passwordPolicy.ts`).
7. **The review trail is kept for good.** Never delete or edit a row of `platform_audit_logs`, and never delete a
   `signup_requests`, `change_requests` or `platform_users` row (switch staff off instead). `src/lib/recordsProtected.test.ts`
   fails if code does. The club repo's migration `20261009000000_protect_review_records` makes the database refuse it too (triggers;
   `db-sync.cmd` does NOT apply it: run `migrate deploy` or paste the file into the Neon SQL editor).
8. Keep the console out of search engines and frames (headers in `next.config.ts`,
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
`RESEND_API_KEY` · `VERCEL_API_TOKEN` · `CLUB_VERCEL_PROJECT_ID` (**the club app's project**, not
ops — club addresses belong to it; deliberately NOT named `VERCEL_PROJECT_ID`, because Vercel fills that name
in itself with ops' own project ID and it overrides ours) · `VERCEL_TEAM_ID` (if a team) · `ROOT_DOMAIN` (default
squadino.com) · `PROVISIONING_SECRET` (same value as the club app's; ops uses it to ask the club app to
start/resume a hold or cancel a subscription).

## Still to do

Two-step sign-in (needs a `PlatformUser` column added from the club repo's schema first);
tests only cover pure logic, so approve → subdomain → setup email has only been checked by
hand.
