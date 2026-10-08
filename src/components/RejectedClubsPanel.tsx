import Link from "next/link";
import SignupRequestDecision from "@/components/SignupRequestDecision";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium" });

export interface WaitingRejection {
  requestId: string;
  signupId: string;
  clubName: string;
  packageKey: string;
  contactName: string;
  reason: string;
  requestedByName: string;
  createdAt: Date;
}

export interface RejectedSignup {
  signupId: string;
  clubName: string;
  packageKey: string;
  contactName: string;
  reason: string | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
}

// The dashboard's "Rejected clubs" box, for super admins and admins only. A moderator's rejection waits at the top
// until an admin approves it or re-instates the signup; signups that are already rejected stay below so an admin
// can still change their mind.
export default function RejectedClubsPanel({ waiting, rejected }: { waiting: WaitingRejection[]; rejected: RejectedSignup[] }) {
  return (
    <div className="bg-slate-800 border border-red-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Rejected clubs</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            When a moderator rejects a signup it waits here for you. Approve the rejection to make it final, or re-instate the signup to put it
            back with the signups waiting for review. Signups already rejected can be re-instated too. Whichever you choose, you give a reason, and it is recorded with your name.
          </p>
        </div>
        {waiting.length > 0 && (
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-900 text-red-300 whitespace-nowrap">{`${waiting.length} waiting`}</span>
        )}
      </div>

      <ul className="mt-4 divide-y divide-slate-700 max-h-80 overflow-y-auto pr-2">
        {waiting.map((r) => (
          <li key={r.requestId} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/signups/${r.signupId}`} className="text-sm font-medium hover:underline">{r.clubName}</Link>
              <span className="ml-2 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Waiting for an admin</span>
              <p className="text-xs text-slate-400 mt-0.5">{`${r.contactName} · ${r.packageKey}`}</p>
              <p className="text-sm text-slate-300 mt-1">{`Reason: ${r.reason}`}</p>
              <p className="text-xs text-slate-500 mt-0.5">{`Asked by ${r.requestedByName} · ${when.format(r.createdAt)}`}</p>
            </div>
            <SignupRequestDecision kind="reject-request" requestId={r.requestId} />
          </li>
        ))}
        {rejected.map((s) => (
          <li key={s.signupId} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/signups/${s.signupId}`} className="text-sm font-medium hover:underline">{s.clubName}</Link>
              <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Rejected</span>
              <p className="text-xs text-slate-400 mt-0.5">{`${s.contactName} · ${s.packageKey}`}</p>
              {s.reason && <p className="text-sm text-slate-300 mt-1">{`Reason: ${s.reason}`}</p>}
              <p className="text-xs text-slate-500 mt-0.5">
                {`${s.rejectedByName ? `Rejected by ${s.rejectedByName}` : "Rejected"}${s.rejectedAt ? ` · ${when.format(s.rejectedAt)}` : ""}`}
              </p>
            </div>
            <SignupRequestDecision kind="rejected" signupId={s.signupId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
