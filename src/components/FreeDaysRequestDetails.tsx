import { freeDaysEmail } from "@/lib/freeDaysEmail";
import { daysWord, describeFreeDates } from "@/lib/freeDays";

// What an admin reads before approving a free-days request: the days, every club it would go to, and the email exactly as the
// customers would get it (the bracketed dates are filled in for each club). Reads the stored request leniently.
export default function FreeDaysRequestDetails({ payload }: { payload: unknown }) {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const dates = Array.isArray(p.dates) ? p.dates.filter((d): d is string => typeof d === "string") : [];
  const clubs = (Array.isArray(p.clubs) ? p.clubs : []).map((c) => (c && typeof c === "object" ? str((c as Record<string, unknown>).name) : "")).filter(Boolean);
  const email = freeDaysEmail({
    clubName: clubs[0] ?? "Example Club",
    recipientName: "Sam Example",
    title: str(p.title) || "[Title]",
    whatHappened: str(p.whatHappened) || "[What happened]",
    whatWeAreDoing: str(p.whatWeAreDoing) || "[What Squadino is doing about it]",
    extraNote: str(p.extraNote) || null,
    dates: dates.length ? dates : ["2026-01-01"],
    effect: "STRIPE",
    oldDateText: "[their current payment date]",
    newDateText: "[their new payment date]",
  });

  return (
    <div className="mt-3 space-y-3 text-sm">
      <p>
        <span className="font-semibold">{daysWord(dates.length)} free:</span> {describeFreeDates(dates)}
      </p>
      <details>
        <summary className="cursor-pointer text-slate-300 hover:text-white">{`${clubs.length} club${clubs.length === 1 ? "" : "s"} would get it`}</summary>
        <p className="mt-2 text-slate-300">{clubs.join(", ")}</p>
      </details>
      <details open>
        <summary className="cursor-pointer text-slate-300 hover:text-white">The email the clubs&apos; admins would get</summary>
        <div className="mt-2 rounded-xl bg-slate-900 border border-slate-700 p-4">
          <p className="text-xs text-slate-400">Subject</p>
          <p className="font-medium mb-3">{email.subject}</p>
          <pre className="whitespace-pre-wrap font-sans text-slate-200">{email.text}</pre>
        </div>
      </details>
    </div>
  );
}
