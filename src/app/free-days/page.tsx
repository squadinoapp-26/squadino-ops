import Link from "next/link";
import { requirePlatformSessionOrRedirect, canApproveChanges, canPrepareFreeDays } from "@/lib/auth";
import { allowedDateRange, daysWord, describeFreeDates, melbourneToday } from "@/lib/freeDays";
import { loadClubChoices, loadGrants } from "@/lib/freeDays.server";
import FreeDaysForm from "./FreeDaysForm";
import RetryButton from "./RetryButton";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });
const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric" });

// Free service days (under App Config): compensation for time Squadino was unavailable. Anyone can prepare one; an admin gives it now and
// everyone else sends it to Approvals. Below the form is what has been given so far and what happened for each club.
export default async function FreeDaysPage() {
  const staff = await requirePlatformSessionOrRedirect();
  if (!canPrepareFreeDays(staff.role)) {
    return <div className="min-h-screen bg-slate-900 text-white p-6">You can&apos;t use this page.</div>;
  }
  const canApprove = canApproveChanges(staff.role);
  const now = new Date();
  const range = allowedDateRange(now);
  const [clubs, { missing, grants }] = await Promise.all([loadClubChoices(), loadGrants()]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Free days</h1>
      </div>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <p className="text-sm text-slate-400">
          Make up for time Squadino was unavailable. Pick the free days on the calendar, choose the clubs, and say what happened. Each club&apos;s admins are emailed, each paying club&apos;s next payment
          moves out by the number of days, and a club on a free trial has its trial extended. {canApprove ? "As an admin you give them straight away, always with a reason." : "An admin approves it before anything happens."}
        </p>

        <FreeDaysForm clubs={clubs} canApprove={canApprove} todayIso={melbourneToday(now)} minIso={range.min} maxIso={range.max} tablesMissing={missing} />

        <section className="space-y-3" id="history">
          <h2 className="font-semibold">Free days given</h2>
          {grants.length === 0 && <p className="text-sm text-slate-500">{missing ? "Nothing to show until the database update has been run." : "None yet."}</p>}
          {grants.map((g) => {
            const done = g.clubs.filter((c) => c.status === "APPLIED").length;
            const failed = g.clubs.filter((c) => c.status === "FAILED").length;
            const emailed = g.clubs.filter((c) => c.emailedAt).length;
            return (
              <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{g.title}</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${g.needsFinishing ? "bg-amber-900 text-amber-300" : "bg-green-900 text-green-300"}`}>
                    {g.needsFinishing ? "Something is left to do" : "All done"}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{`${daysWord(g.dayCount)}: ${describeFreeDates(g.freeDates)}`}</p>
                <p className="text-xs text-slate-500 mt-1">{`Given by ${g.approvedByName} · ${when.format(g.createdAt)} · ${g.clubs.length} club${g.clubs.length === 1 ? "" : "s"}: ${done} done${failed ? `, ${failed} not done` : ""}, ${emailed} emailed`}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-slate-300 hover:text-white">See each club</summary>
                  <ul className="mt-2 space-y-1.5">
                    {g.clubs.map((c) => (
                      <li key={c.clubName} className="text-sm bg-slate-900/50 rounded-xl px-3 py-2">
                        <span className="font-medium">{c.clubName}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${c.status === "APPLIED" ? "bg-green-900 text-green-300" : c.status === "FAILED" ? "bg-red-900 text-red-300" : "bg-amber-900 text-amber-300"}`}>
                          {c.status === "APPLIED" ? "Done" : c.status === "FAILED" ? "Not done" : "Waiting"}
                        </span>
                        <span className="block text-xs text-slate-400 mt-0.5">
                          {c.status === "APPLIED"
                            ? c.effect === "STRIPE" && c.oldDate && c.newDate ? `Next payment moved from ${day.format(c.oldDate)} to ${day.format(c.newDate)}`
                              : c.effect === "TRIAL" && c.oldDate && c.newDate ? `Free trial end moved from ${day.format(c.oldDate)} to ${day.format(c.newDate)}`
                              : "No payment or trial to move; recorded only"
                            : c.error ?? "Not reached yet"}
                          {c.emailedAt ? ` · emailed ${c.emailedTo.join(", ")}` : c.status === "APPLIED" ? ` · not emailed yet${c.emailError ? `: ${c.emailError}` : ""}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
                {g.needsFinishing && canApprove && <div className="mt-3"><RetryButton id={g.id} /></div>}
                {g.needsFinishing && !canApprove && <p className="text-xs text-slate-500 mt-3">An admin can finish the ones that are not done.</p>}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
