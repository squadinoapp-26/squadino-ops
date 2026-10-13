"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });

export interface ExtraMemberItem {
  id: string;
  clubId: string;
  clubName: string;
  members: number;
  price: string;
  requestedByName: string;
  requestedByEmail: string;
  createdAt: string;
  approvedSoFar: number;
}

// The dashboard's "Extra member requests" box, for admins and moderators: a club that has used up its member
// limit asked for a pack of extra members. Approving adds them to the club's Stripe subscription and raises its
// limit; declining tells the club's admin why. Admins always give a reason; a moderator's note on an approval is optional.
export default function ExtraMemberRequestsPanel({ items, isAdmin }: { items: ExtraMemberItem[]; isAdmin: boolean }) {
  return (
    <div className="bg-slate-800 border border-blue-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Extra member requests</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Clubs that have reached their member limit and asked for more. Approving adds the members to the club&apos;s Stripe
            subscription (50 cents each, per month) and raises its limit straight away.
          </p>
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full bg-blue-900 text-blue-300 whitespace-nowrap">{`${items.length} waiting`}</span>
      </div>
      <ul className="mt-4 divide-y divide-slate-700 max-h-[28rem] overflow-y-auto pr-2">
        {items.map((r) => <Row key={r.id} item={r} isAdmin={isAdmin} />)}
      </ul>
    </div>
  );
}

function Row({ item, isAdmin }: { item: ExtraMemberItem; isAdmin: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "decline") {
    setBusy(decision);
    setError("");
    const res = await fetch(`/api/extra-members/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res || !res.ok) {
      setError(data?.error ?? "Couldn't reach the server. Try again.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <li className="py-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/clubs/${item.clubId}`} className="text-sm font-medium hover:underline">{item.clubName}</Link>
          <p className="text-sm text-slate-200 mt-0.5">{`${item.members} extra members · ${item.price} a month`}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {`Asked for by ${item.requestedByName} (${item.requestedByEmail}) · ${when.format(new Date(item.createdAt))}`}
          </p>
          {item.approvedSoFar > 0 && <p className="text-xs text-slate-500">{`Already has ${item.approvedSoFar} extra members.`}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={isAdmin ? "Reason (required)" : "Reason (required to decline, optional to approve)"}
          aria-label={`Reason for ${item.clubName}`}
          className="flex-1 min-w-[14rem] bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => decide("approve")}
          disabled={busy !== null}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy === "approve" ? "Updating Stripe…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("decline")}
          disabled={busy !== null}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </li>
  );
}
