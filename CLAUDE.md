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

Signups (review, correct, approve, reject with a reason an admin must confirm) · Set up subdomain (Vercel) · Send setup email ·
Club status (deactivate / reactivate / delete after 12 months) · New Client (by hand) ·
Sports list · Restricted words · Logs (searchable by club or staff name, username, email, web address, task, date and reason: `listAuditLogs` in `src/lib/auditLog.server.ts`) · Manage users (staff) · Packages & prices ·
**Screens refresh themselves** (owner, 2026-10-23: staff had to remember to reload): `LiveRefresh` (`src/components/LiveRefresh.tsx`, mounted once in the root `src/app/layout.tsx`, silent on the sign-in pages) asks `GET /api/live-version` every 20 s while the tab is visible and someone is around (it stops after 15 minutes with no mouse, key or touch, so a screen left open does not keep the database awake, and asks straight away when the person comes back to the tab). The answer is a short fingerprint (`loadLiveVersion`, `src/lib/liveVersion.server.ts`: row counts and latest timestamps of Logs, signups, requests, extra-member and Full-package requests, clubs, club billing and free-days rows; reveals nothing about the data). When it changes the page re-reads itself in place (`router.refresh()`, so open forms keep what was typed); **if the person is typing or choosing in a box at that moment nothing moves**: a small "New changes have come in. Refresh" bar appears instead (`decideRefresh`, `isTypingTarget` in `src/lib/liveRefresh.ts`, pure and tested). The first answer on a page also triggers one extra read, because the page was drawn a moment before it (found by the real run: a change landing within a second of opening a page was otherwise missed). A 401 (signed out) stops it. **When a new screen shows data that changes WITHOUT a Logs line (like a signup arriving from the website), add its table to `loadLiveVersion`.** Checked 2026-10-23 with 17 browser checks on a scratch database (a new signup moved the dashboard badge, another person's request appeared on Approvals, the bar while typing, the typed words surviving, a hidden tab asking nothing, the session ending stops it, the sign-in page never asks). · **Free days** (App Config > Free days, `/free-days`; owner 2026-10-21): compensation for time Squadino was unavailable. Anyone who can sign in prepares it (`canPrepareFreeDays`): a title, what happened and why, what Squadino is doing to fix it, the free days on a calendar (the picked days ARE the free days), the clubs (search, tick or Select all) and a written reason, with a live preview of the email. An admin gives it straight away; everyone else sends a `ChangeRequest` of type `FREE_DAYS` that an admin approves in Approvals with a written reason (`decisionNoteRequired`; the page shows the days, every club and the exact email). Both go through `submitChange` / `executeChange`, which asks the club app (`applyFreeDaysInClubApp`, `POST /api/billing/free-days`) to move each paying club's next payment out (Stripe), extend free trials and email each club's admins, once per club; a half-finished one is completed by an admin with **Finish the ones not done** (`POST /api/free-days/[id]`, `continueFreeDaysInClubApp`). History and per-club results show on the same page (`loadGrants`). Logs: `free_days.sent`, `free_days.retried` (the club app writes `billing.free_days` per club). **`src/lib/freeDays.ts` and `freeDaysEmail.ts` (with their tests) are IDENTICAL copies of the club app's: change both together.** Merge the club app's pull request first. Details: club `CLAUDE.md` Key flows "Free service days". · Manage accounts (searchable club list; each club's card shows its package (`Package: Growth`) and its user limit override when it has one (`User limit override: 1,250`), and a club with NO package and NO override is flagged amber "No package (can't add members)" because the club app refuses new members for it; wording in `clubPlanLabels`, `src/lib/clubAccounts.ts`) · dashboard alerts · each club's Stripe billing status
(plan, cancelling, payment failed) — written by the club app's `/api/billing/sync` into the
`club_billing` table, read-only here. Roles: SUPER_ADMIN, ADMIN,
MODERATOR, CUSTOMER_CARE — see `src/lib/auth.ts` (`can…` helpers, tested in `roles.test.ts`).

**Remove extra members** (owner, 2026-10-24: "build a button"; club `CLAUDE.md` Key flows "Member limit" has the full design): club page > the **Extra members** box (`RemoveExtraMembersPanel`, shown for a club that has ever had extras, `approvedExtraMemberRowsFor`; it stays on screen at 0 so its message is not lost). How many (up to what the club has), a REQUIRED reason, a tick "credit the unused part of this month" (on) and a tick "email the club's admins" (on). A live preview shows the Stripe charge and the member limit before and after, and warns when the club would be over its new limit (nobody is removed, new members just can't be added: `removalPreview` in `extraMembers.ts`). **An admin (SUPER_ADMIN or ADMIN) does it straight away after a confirm box; everyone else sends a `ChangeRequest` of type `EXTRA_MEMBERS_REMOVE` that an admin approves in Approvals with a written reason** (`submitChange` / `executeChange` / `decideChange`, `parseExtraMembersRemove`, `decisionNoteRequired`, `describeChange`), the same rule as plan changes (rule 5). The route is `POST /api/clubs/[id]/extra-members` and takes the one-person-per-club lock (rule 9). Ops only asks: `removeExtraMembersInClubApp` calls the club app's `/api/billing/actions` (`remove_extra_members`), which lowers (or takes off) the Stripe line, adds a negative approved row so the club's limit drops, and emails the club's admins if asked; ops then writes the Logs line `billing.extra_members_removed` (`describeRemovalResult`). `cleanReason.ts` holds the reason helper (split out of `changeRequests.ts` so `extraMembers.ts` doesn't import it back). The club app's side is MERGED (club #81, 2026-10-24); this ops side is on its branch and its pull request was not opened yet when this was written (2026-10-25: ask the owner). Checked 2026-10-24 with both production builds on a scratch Postgres (60 checks); not yet seen against real Stripe.

**Emails that could not be sent** (owner, 2026-10-23: an extra-members email to hello@squadino.com never arrived and nothing said why): the club app now writes every undelivered email of the extra-members and Full package flows into the Logs as task `email.failed` ("An email could not be sent", heading "Emails", actor "SQUADINO app", with the mail provider's own reason; club `CLAUDE.md` Key flows "Emails to the team"). Ops lists the last 7 days in the dashboard box **"Emails that could not be sent"** (`EmailProblemsPanel`, `src/lib/emailProblems.ts` and `.server.ts`, up to 10, for SUPER_ADMIN and ADMIN only, the same people who can read the Logs, with a link to `/logs?task=email.failed`). The action key `email.failed` is written by the club app: keep it in `AUDIT_ACTIONS` (a test checks it). Nothing to run in Neon.

**One person per club account** (owner, 2026-10-23: "no 2 customer care officers can update a club at the same time. BUT, an admin can open any account"): a customer care officer or a moderator can have a club's page (`/clubs/[id]`) open only while nobody else of those two roles has it; SUPER_ADMIN and ADMIN are never held and never hold (`needsExclusiveAccess`, `src/lib/clubAccess.ts`; a role the code does not know is held). The table `club_access_locks` (club schema, mirrored here; migration `20261023000000_club_access_locks`, Neon paste-in `docs/claude/neon-club-access-locks.sql` in the club repo) has one row per club: who, a page marker `viewId`, `lastBeatAt`, `lastActiveAt`, and `endedAt` / `endedByName` when an admin took the club over. **The page takes the hold BEFORE reading any club data** (`acquireClubAccess` in `src/lib/clubAccess.server.ts`: one `INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING` on the database's clock, so two people opening in the same instant cannot both get in). A second officer gets `ClubBlocked` (name, code, who is in; no club data), an officer an admin put out gets `ClubAccessEnded`, an admin gets `ClubPresencePanel` (who is in, **Take over**, and a notice when the table is missing), and an officer who holds it gets `ClubAccessKeeper` (heartbeat every 30 s with whether they touched the page, release when the page closes through `sendBeacon` with the page marker so a reload can't free the new page's hold, and a cover message when the hold ends). A hold ends when the page is left, 3 minutes after the heartbeat stops (`BEAT_GRACE_MS`), after 30 minutes with no activity (`IDLE_LIMIT_MS`, the owner's choice), or when an admin takes over. **Take over** (`POST /api/clubs/[id]/access/take-over`, admins only) marks the row ended, writes `club.access_taken_over` to the Logs (the ONLY lock event logged), and keeps that officer out for `KEEP_OUT_MS` (30 minutes) or until someone else opens the club: without that their self-refreshing page (LiveRefresh) took the club straight back (found by the real browser run); the 30 minutes is Claude's addition, owner to confirm. Everything fails OPEN before the table exists (nobody blocked, admins told). Proven 2026-10-23 on a scratch Postgres with the production build and Chromium (77 checks, plus 10 with the table missing). **Not covered by the lock (owner's decision):** the dashboard boxes (extra-member and Full package decisions). Details and limits: club `docs/claude/HANDOFF.md`.

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
   out; change both together), `hostClub.ts`, `subdomain.ts` (also holds `suggestSubdomains`: the short web-address choices on the approve screen and New Client form, owner 2026-10-19, initials first; identical copy and tests in the club app), `sportCatalog.ts`,
   `restrictedWordsList.ts`, and `welcomeEmail` in `src/lib/email.ts` (the setup email: set the password, how to sign in, quick tips for setting the club up; the club app's
   `src/lib/email.ts` holds an IDENTICAL copy and each repo has the same `welcomeEmail.test.ts`; `sendOwnerSetupEmails` passes the owner's email and, for a Coach-plan club, `coach: true` so the tips fit a
   coaching business). It is the "second email" that the club app's "We've received your signup" email promises the customer (owner, 2026-10-17). Its set-password link is valid for 24 hours (`SETUP_LINK_TTL_MINUTES` in `src/lib/passwordReset.server.ts`, an identical copy of the club app's file); only "Forgot password" keeps 60 minutes.
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
   **Public routes** (login, forgot password, reset password) read their body with `readJson` (`src/lib/readJson.ts`, a copy of the club app's) so broken JSON or a bare `null` is a 400, not a 500. **Login timing:**
   the login checks the password for every real account, switched on or off, and calls `burnVerifyTime` (`src/lib/password.ts`) when there is no account, so the answer takes the same time whichever it is (30 ms against 30 ms
   measured 2026-10-14; before, a switched-off or unknown email answered in 15 ms against 31 ms for a live one).
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
     down. **The customer is emailed when a rejection becomes final** (owner, 2026-10-21; `signupRejectedEmail`, `src/lib/signupRejectedEmail.ts`, wording approved as drafted: "Thanks for your interest in SQUADINO for {club}. Unfortunately we aren't able to set up an account for you." + the admin's optional message + how to reach hello@squadino.com): an admin's own rejection, or an admin approving a moderator's request, sent from `executeChange` `SIGNUP_REJECT`; never when a moderator only asks, and never when the request is turned down. The reject form has a tick box "Email the customer" (ticked to start with; untick it for a test signup) and an optional **message to the customer**; the staff reason is private and is NEVER in the email. Only an explicit `emailCustomer: true` in the request sends (requests made before this existed email nobody). A mail failure never undoes the rejection; the Logs line says "Customer emailed with this message: ...", "Customer not emailed" or "Customer email could NOT be sent". The email reads as automatic (its test carries the same forbidden-words check as the club app's `customerWording.test.ts`). The admin-only dashboard boxes are **Pre-approved clubs** and **Rejected clubs**; an already-rejected signup
     can be re-instated there or on its page (`POST /api/signups/[id]/reinstate`).
   - **Everything is recorded with the person's name and role, and nothing can be deleted.** Each step writes a Logs
     entry on the signup itself (`signup.preapprove`, `signup.reject_requested`, `signup.approve`, `signup.reject`,
     `signup.preapprove_declined`, `signup.reinstate`), and the signup page shows them to all staff as "Review history".
     See rule 7.
   - **Correcting a signup's details is two-step too** (owner, 2026-10-19: customers make typing mistakes; type `SIGNUP_EDIT`, no schema change). On `/signups/[id]` ("Edit details",
     `PATCH /api/signups/[id]`) anyone who can review signups can correct a PENDING signup, and **everyone gives a written reason** (`parseSignupEditRequest`, `src/lib/changeRequests.ts`, built
     on the old `parseSignupEdit` field rules). SUPER_ADMIN and ADMIN correct straight away (`submitChange` runs `executeChange`, Logs `signup.edit` with old to new values and the reason);
     a moderator or customer care officer only SENDS it: a `ChangeRequest` holds the new details AND the details as they were (`SignupEditPayload`), the signup stays unchanged, and the page
     shows the proposal as old to new. An admin approves or declines at `/approvals` or on the signup page with a written reason (`decisionNoteRequired`); only approval saves. Approval
     re-checks that the signup is still PENDING and still has the "before" details (otherwise the request fails with a clear message and the signup is unblocked), validates the new details
     again, and the status in the update filter stops it landing on a signup someone just approved. A waiting correction pauses approve / pre-approve / reject / edit for that signup
     (`pendingEditFor`, `src/lib/signupReview.server.ts`; the signup stays in the "new" list with a tag, unlike a waiting pre-approval or rejection), and a waiting pre-approval or rejection
     pauses corrections. Logs: `signup.edit_requested`, `signup.edit` (on approval), `signup.edit_declined`, plus the usual `request.*` entries; all appear in the signup's Review history with
     the old to new values. The customer is NOT emailed about a correction. The package change keeps its Stripe warning: correcting the package here changes the club the approval creates, not the Stripe subscription.
6. Staff passwords are at least 12 characters (`src/lib/passwordPolicy.ts`).
7. **The review trail is kept for good.** Never delete or edit a row of `platform_audit_logs`, and never delete a
   `signup_requests`, `change_requests` or `platform_users` row (switch staff off instead). `src/lib/recordsProtected.test.ts`
   fails if code does. The club repo's migration `20261009000000_protect_review_records` makes the database refuse it too (triggers;
   `db-sync.cmd` does NOT apply it: run `migrate deploy` or paste the file into the Neon SQL editor).
8. Keep the console out of search engines and frames (headers in `next.config.ts`,
   `src/app/robots.ts`, `robots` in the layout).
9. **Every route under `/api/clubs/[id]` that changes a club must call `assertClubAccess(staff, id)` (`src/lib/clubAccess.server.ts`) before it does anything.**
   It lets admins straight through and answers 423 to a customer care officer or moderator who does not hold the club, so the screen's hiding of buttons is never the only
   lock. A route only admins may call checks the role (`canManageClubStatus` / `canManageClients`) and is listed in `ADMIN_ONLY` in `src/lib/clubAccessGuard.test.ts`, which fails
   if a new route has neither. The lock's own routes (`/api/clubs/[id]/access/**`) are the exception. A NEW place that lets staff change a club must also take the hold in its page.

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
