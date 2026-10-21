"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FreeDaysCalendar from "./FreeDaysCalendar";
import { freeDaysEmail } from "@/lib/freeDaysEmail";
import { NOTE_MAX, TEXT_MAX, TITLE_MAX, daysWord, describeFreeDates, parseFreeDaysRequest } from "@/lib/freeDays";
import type { ClubChoice } from "@/lib/freeDays.server";

const field = "w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "block text-sm font-medium text-slate-200 mb-1";
const card = "bg-slate-800 border border-slate-700 rounded-2xl p-5";

const shortDate = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric" });

function billingText(c: ClubChoice): string {
  if (c.billing === "stripe") return "Pays through Stripe: next payment moves out";
  if (c.billing === "trial") return `Free trial${c.trialEndsAt ? ` to ${shortDate.format(new Date(c.trialEndsAt))}` : ""}: trial end moves out`;
  return "Nothing to move: recorded only";
}

export default function FreeDaysForm({
  clubs, canApprove, todayIso, minIso, maxIso, tablesMissing,
}: {
  clubs: ClubChoice[];
  canApprove: boolean;
  todayIso: string;
  minIso: string;
  maxIso: string;
  tablesMissing: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [whatWeAreDoing, setWhatWeAreDoing] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  // Makes a direct submission happen once, even if the button is pressed twice.
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      clubs.filter((c) => (showInactive || c.active) && (!q || [c.name, c.code, c.slug, c.packageName ?? ""].some((t) => t.toLowerCase().includes(q)))),
    [clubs, q, showInactive],
  );
  const selectable = shown.filter((c) => c.active);
  const chosenClubs = clubs.filter((c) => chosen.has(c.id));
  const adminsToEmail = chosenClubs.reduce((n, c) => n + c.admins, 0);
  const noAdmin = chosenClubs.filter((c) => c.admins === 0);

  const checked = parseFreeDaysRequest(
    { title, whatHappened, whatWeAreDoing, extraNote, dates, clubs: chosenClubs.map((c) => ({ id: c.id, name: c.name })) },
    new Date(),
  );
  const problem = !checked.ok ? checked.error : !reason.trim() ? "Say why you are giving these free days. It is recorded with your name." : null;

  const preview = freeDaysEmail({
    clubName: chosenClubs[0]?.name ?? "Example Club",
    recipientName: "Sam Example",
    title: title.trim() || "[Title]",
    whatHappened: whatHappened.trim() || "[What happened]",
    whatWeAreDoing: whatWeAreDoing.trim() || "[What Squadino is doing about it]",
    extraNote: extraNote.trim() || null,
    dates: dates.length ? dates : [todayIso],
    effect: "STRIPE",
    oldDateText: "[their current payment date]",
    newDateText: "[their new payment date]",
  });

  function toggleClub(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/free-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, whatHappened, whatWeAreDoing, extraNote, dates, clubIds: [...chosen], reason, submissionKey }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      router.refresh(); // an approval that failed part way shows in the list below
      return;
    }
    if (data.requested) {
      setDone("Sent for approval. An admin will see it in Approvals, with the email exactly as written here. Nothing has changed for any club yet.");
    } else {
      const c = data.counts as { total: number; applied: number; failed: number; emailed: number } | null;
      setDone(
        c
          ? `Done. ${c.applied} of ${c.total} club${c.total === 1 ? "" : "s"} now have the free days, ${c.emailed} had their admins emailed${c.failed ? `, and ${c.failed} could not be done (see the list below)` : ""}.`
          : "Done. The free days were given and the clubs' admins emailed.",
      );
    }
    // A fresh key for the next one.
    setSubmissionKey(crypto.randomUUID());
    setTitle(""); setWhatHappened(""); setWhatWeAreDoing(""); setExtraNote(""); setDates([]); setChosen(new Set()); setReason("");
    router.refresh();
  }

  if (done) {
    return (
      <div className={`${card} space-y-3`} role="status">
        <p className="font-semibold">{done}</p>
        <button type="button" onClick={() => setDone(null)} className="bg-slate-700 hover:bg-slate-600 text-sm font-semibold px-4 py-2 rounded-xl">Make another</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tablesMissing && (
        <p className="rounded-xl bg-amber-950 text-amber-300 px-4 py-3 text-sm">
          The database update for free days hasn&apos;t been run yet, so this can&apos;t be used until it is (paste <span className="font-mono">docs/claude/neon-free-days.sql</span> into Neon&apos;s SQL Editor).
        </p>
      )}

      <section className={`${card} space-y-4`}>
        <h2 className="font-semibold">1. What happened</h2>
        <p className="text-sm text-slate-400">These words are emailed to the clubs, so write them for the customer, in plain language.</p>
        <div>
          <label htmlFor="fd-title" className={label}>Title (also the email&apos;s subject)</label>
          <input id="fd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} placeholder="Service interruption on 3 November" className={field} />
        </div>
        <div>
          <label htmlFor="fd-happened" className={label}>What happened, and why</label>
          <textarea id="fd-happened" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} maxLength={TEXT_MAX} rows={4}
            placeholder="For example: our database provider had an outage and the app could not load for about 6 hours." className={field} />
        </div>
        <div>
          <label htmlFor="fd-fix" className={label}>What Squadino is doing to fix it</label>
          <textarea id="fd-fix" value={whatWeAreDoing} onChange={(e) => setWhatWeAreDoing(e.target.value)} maxLength={TEXT_MAX} rows={4}
            placeholder="For example: we have moved to a second region and added an alert so we know straight away." className={field} />
        </div>
        <div>
          <label htmlFor="fd-extra" className={label}>Anything else to tell them (optional)</label>
          <textarea id="fd-extra" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} maxLength={NOTE_MAX} rows={2} className={field} />
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-1">2. The free days</h2>
        <p className="text-sm text-slate-400 mb-3">
          The days you pick are the days the clubs are told are free. Each paying club&apos;s next payment moves out by that many days (nothing is charged or refunded), and a club on a free trial has its trial extended by the same number.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <FreeDaysCalendar selected={dates} onChange={setDates} todayIso={todayIso} minIso={minIso} maxIso={maxIso} />
          <div>
            <p className="text-sm font-medium text-slate-200 mb-1">Your free days</p>
            {dates.length === 0
              ? <p className="text-sm text-slate-400">None picked yet.</p>
              : <p className="text-sm"><span className="font-semibold">{daysWord(dates.length)}:</span> {describeFreeDates(dates)}</p>}
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-1">3. Which clubs</h2>
        <p className="text-sm text-slate-400 mb-3">Each club&apos;s admins get the email. Any account can be chosen, whatever its plan or size.</p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label htmlFor="fd-search" className="sr-only">Search clubs</label>
          <input id="fd-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, code, web address or plan…"
            className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" disabled={selectable.length === 0} onClick={() => setChosen((p) => new Set([...p, ...selectable.map((c) => c.id)]))}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold px-3 py-2 rounded-xl">
            {q ? `Select all matching (${selectable.length})` : `Select all (${selectable.length})`}
          </button>
          <button type="button" disabled={chosen.size === 0} onClick={() => setChosen(new Set())}
            className="text-sm text-slate-300 hover:text-white underline disabled:opacity-50 px-2 py-2">Clear selection</button>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show switched-off clubs
          </label>
        </div>
        <p className="text-sm text-slate-300 mb-2" aria-live="polite">
          {`${chosen.size} club${chosen.size === 1 ? "" : "s"} selected · ${adminsToEmail} admin${adminsToEmail === 1 ? "" : "s"} will be emailed`}
          {noAdmin.length > 0 && <span className="text-amber-300">{` · ${noAdmin.length} selected club${noAdmin.length === 1 ? " has" : "s have"} no admin email (the days are still given, but nobody is emailed)`}</span>}
        </p>
        <div role="group" aria-label="Clubs" className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
          {shown.map((c) => (
            <label key={c.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${chosen.has(c.id) ? "border-blue-500 bg-blue-950/40" : "border-slate-700 bg-slate-900/40"} ${c.active ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" className="mt-1" checked={chosen.has(c.id)} disabled={!c.active} onChange={() => toggleClub(c.id)} aria-label={`Choose ${c.name}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{c.code}</span>
                  {c.packageName && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{c.packageName}</span>}
                  {!c.active && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Switched off</span>}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {`${c.members} member${c.members === 1 ? "" : "s"} · `}
                  <span className={c.admins === 0 ? "text-amber-300" : ""}>{c.admins === 0 ? "no admin email" : `${c.admins} admin${c.admins === 1 ? "" : "s"} to email`}</span>
                  {` · ${billingText(c)}`}
                </span>
              </span>
            </label>
          ))}
          {shown.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No clubs match.</p>}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-1">4. The email they will get</h2>
        <p className="text-sm text-slate-400 mb-3">Each club&apos;s admins get this, with that club&apos;s own name and dates. The bracketed parts are filled in for each club.</p>
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-4">
          <p className="text-xs text-slate-400">Subject</p>
          <p className="text-sm font-medium mb-3">{preview.subject}</p>
          <pre className="text-sm whitespace-pre-wrap font-sans text-slate-200">{preview.text}</pre>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          A club on a free trial is told its trial end moved instead, and a club with no payment to move is told the free days are recorded on its account.
        </p>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">5. {canApprove ? "Give the free days" : "Send for approval"}</h2>
        <div>
          <label htmlFor="fd-reason" className={label}>Your reason (required, recorded in the Logs with your name)</label>
          <input id="fd-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={field}
            placeholder="For example: outage on 3 November, owner agreed 2 free days for every club" />
        </div>
        {!canApprove && <p className="text-sm text-slate-400">An admin approves this in Approvals. Nothing changes for any club, and no email goes out, until they do.</p>}
        {problem && <p className="text-sm text-amber-300">{problem}</p>}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        {!confirming ? (
          <button type="button" disabled={!!problem || tablesMissing} onClick={() => setConfirming(true)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl">
            {canApprove ? "Review and give the free days…" : "Review and send for approval…"}
          </button>
        ) : (
          <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-4 space-y-3">
            <p className="text-sm">
              {canApprove
                ? `You are about to give ${chosenClubs.length} club${chosenClubs.length === 1 ? "" : "s"} ${daysWord(dates.length)} free (${describeFreeDates(dates)}). Each paying club's next payment moves out by ${daysWord(dates.length)}, and ${adminsToEmail} admin${adminsToEmail === 1 ? "" : "s"} will be emailed straight away. This cannot be undone from here.`
                : `You are about to send an admin a request to give ${chosenClubs.length} club${chosenClubs.length === 1 ? "" : "s"} ${daysWord(dates.length)} free (${describeFreeDates(dates)}). Nothing changes until they approve it.`}
            </p>
            <div className="flex gap-3">
              <button type="button" disabled={busy} onClick={submit} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl">
                {busy ? "Working…" : canApprove ? "Yes, give the free days and email the clubs" : "Yes, send for approval"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="bg-slate-700 hover:bg-slate-600 text-sm font-semibold px-5 py-2 rounded-xl">Go back</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
