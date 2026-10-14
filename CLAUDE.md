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
Sports list · Restricted words · Logs (searchable by club or staff name, username, email, web address, task, date and reason: `listAuditLogs` in `src/lib/auditLog.server.ts`) · Manage users (staff) · Packages & prices ·
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
   **Member limits:** a club's limit is its package's `userCap`, or its override (the club app's
   `src/lib/memberLimit.ts` enforces it), plus any extra members it has bought. A club with no package can't add members, so approving a
   signup must link the `Package` row with the signup's key (`provisionSignup` does), and the club page
   warns when a club has none. Removed members don't count.
   **Extra member requests** (owner, 2026-10-13): a full club's admin asks for 25, 50 or 100 more (50 cents each, per month); the dashboard's "Extra member
   requests" box lists them for SUPER_ADMIN, ADMIN and MODERATOR (`canDecideExtraMembers`; customer care only looks). Approving asks the club app
   (`decideExtraMembersInClubApp` to `/api/billing/actions`) to add them to the club's Stripe subscription and mark the request; ops then writes the Logs
   entry (`billing.extra_members_approved`/`_declined`). A decline always needs a reason; an admin gives one on approving too (moderator: optional).
   The table `extra_member_requests` comes from the club app's schema (mirrored here).
   **Full package** (owner, 2026-10-14): for MORE than 1,000 members, priced per member by agreement, no free trial. A visitor asks on the website (monthly or
   yearly); that is a `FullPackageRequest` row (club app schema, mirrored here). ONLY SUPER_ADMIN and ADMIN (`canManageFullPackage`) see the dashboard's "Full package
   requests" box (`FullPackageRequestsPanel`) and act: enter the number of members (1,001 or more) and the price per member per month, see the live total
   (`src/lib/fullPackage.ts`, a copy of the club app's money rules: monthly = members x price, yearly = 12 months less 5%), then **Send invoice**
   (`POST /api/full-requests/[id]` to `runFullAction`, which asks the club app's `/api/billing/full` to create the Stripe customer, price, `send_invoice`
   subscription (14 days to pay) and email the customer). Every action needs a written reason. **Cancel invoice and re-price** voids it; **Close request** does not email
   the customer. Logs: `full.invoice_sent`, `full.invoice_cancelled`, `full.closed` (written here), `full.requested`, `full.paid` (written by the club app). When
   Stripe's `invoice.paid` arrives the club app turns the request into a normal pending signup (package `full`, trial 0) and the usual review follows;
   `provisionSignup` then sets the club's `userCapOverride` to the agreed number of members (the Full package row has no cap).
   **Sign-in lockout rules** (`src/lib/rateLimitRules.ts`, copied from the club app's `rateLimitRules.ts` and `clientIp` in `src/lib/geoip.ts`; both apps share the `login_attempts`
   table): 5 wrong tries per email and 30 per IP address in 15 minutes. The visitor's address comes only from `x-real-ip` then `x-forwarded-for` (Vercel overwrites both); NEVER
   read `cf-connecting-ip`, which any visitor can forge because there is no Cloudflare in front (found and fixed 2026-10-13). Database time limits in `src/lib/prisma.ts`
   (`DB_CONNECT_TIMEOUT_MS` 15 s, `DB_QUERY_TIMEOUT_MS` 30 s) follow the club app: no `statement_timeout` (Neon's pooler can refuse it), and no connect timeout under 15 s
   (it also caps the wait for a pooled connection).
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
- **Dependencies:** never run `npm audit fix --force` (it would downgrade Prisma 7 to 6). The safe `npm audit fix` was run 2026-10-14 (Prisma, its client and the adapter are all 7.10.0, the same as the
  club app's tools); the 4 high advisories left in production are inside the Prisma CLI's own tools and have no fix without that downgrade. `.github/dependabot.yml` asks for one weekly pull request with
  minor and patch updates; this repo has NO automatic checks, so before merging one, look at its Vercel preview and run `npm test` and the type check.
- **Node versions (test finding F10):** `.nvmrc` says 24 (the owner's PC). Ops runs the same Next 16 and Prisma 7 as the club app, so it needs Node 20.19+, 22.12+ or 24; its tests pass on Node 20.20 and 22.23 (checked 2026-10-14) as well as 24. There is no
  CI here, so run `npm test` and a build yourself. There is deliberately no `engines` field (Vercel would pick the newest Node on its own): the production Node version is the one in the Vercel project's settings.

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
