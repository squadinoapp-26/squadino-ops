import Link from "next/link";
import { PLATFORM_ROLE_LABELS } from "@/lib/auth";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium" });

export interface PreApprovedSignup {
  signupId: string;
  clubName: string;
  packageKey: string;
  contactName: string;
  slug: string | null;
  paymentChecked: boolean;
  notes: string | null;
  preApprovedByName: string;
  preApprovedByRole: string;
  createdAt: Date;
}

// The dashboard's "Pre-approved clubs" box, for super admins and admins only: signups a moderator or customer care
// officer has checked and pre-approved, waiting for the admin's final approval (which creates the club). The final
// approval needs a reason and the web address can be changed, so it is done on the signup's own page.
export default function PreApprovedClubsPanel({ items, rootDomain }: { items: PreApprovedSignup[]; rootDomain: string }) {
  return (
    <div className="bg-slate-800 border border-green-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Pre-approved clubs</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            A moderator or customer care officer has checked these signups and pre-approved them. Open one to give the final approval
            (the club is created) or send it back, with your reason.
          </p>
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full bg-green-900 text-green-300 whitespace-nowrap">{`${items.length} waiting`}</span>
      </div>
      <ul className="mt-4 divide-y divide-slate-700 max-h-72 overflow-y-auto pr-2">
        {items.map((r) => (
          <li key={r.signupId} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.clubName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{`${r.contactName} · ${r.packageKey} · ${r.slug ? `${r.slug}.${rootDomain}` : "web address from the club name"}`}</p>
              <p className="text-xs text-slate-400">{r.paymentChecked ? "Payment checked" : "No payment to check"}</p>
              {r.notes && <p className="text-sm text-slate-300 mt-1">{`Notes: ${r.notes}`}</p>}
              <p className="text-xs text-slate-500 mt-0.5">
                {`Pre-approved by ${r.preApprovedByName} (${PLATFORM_ROLE_LABELS[r.preApprovedByRole] ?? r.preApprovedByRole}) · ${when.format(r.createdAt)}`}
              </p>
            </div>
            <Link href={`/signups/${r.signupId}`} className="bg-green-700 hover:bg-green-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Review &amp; approve →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
