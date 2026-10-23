import Link from "next/link";
import { EMAIL_PROBLEM_DAYS, type EmailProblem } from "@/lib/emailProblems";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });

// Dashboard box for the people who can read the Logs: emails the app could not deliver in the last week, with the mail provider's own
// reason. Nothing to press here; it is a prompt to look at the mail settings or the Resend dashboard.
export default function EmailProblemsPanel({ problems, total }: { problems: EmailProblem[]; total: number }) {
  return (
    <div className="bg-slate-800 border border-red-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Emails that could not be sent</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            In the last {EMAIL_PROBLEM_DAYS} days the app could not deliver these. The reason in brackets comes from the mail provider. Check the Resend
            dashboard (Emails) and the mail settings of the club app in Vercel (RESEND_API_KEY, MAIL_FROM, STAFF_NOTIFY_EMAIL).
          </p>
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-900 text-red-200">{total}</span>
      </div>
      <ul className="mt-4 divide-y divide-slate-700">
        {problems.map((p) => (
          <li key={p.id} className="py-2.5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium truncate">{p.label}</p>
              <span className="text-xs text-slate-300 whitespace-nowrap">{when.format(p.at)}</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 break-words">{p.note}</p>
            {p.href && <Link href={p.href} className="text-xs text-slate-300 underline hover:text-white mt-1 inline-block pointer-coarse:min-h-11">Open →</Link>}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Link href="/logs?task=email.failed" className="text-xs text-slate-300 underline hover:text-white pointer-coarse:min-h-11 inline-block">
          {total > problems.length ? `See all ${total} in the Logs →` : "See them in the Logs →"}
        </Link>
      </div>
    </div>
  );
}
