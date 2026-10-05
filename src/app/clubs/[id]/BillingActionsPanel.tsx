"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "offer_hold" | "resume" | "cancel";

const COPY: Record<Action, { label: string; confirm: string; tone: string; done: string }> = {
  offer_hold: {
    label: "Send account hold offer",
    confirm: "Email the customer an offer to put their club on hold? It is $50/month for up to 3 months, with Wall, Chat, Training and Stats off and no new members; yearly customers are credited for the unused part of their year. NOTHING changes unless the customer says yes on the link in the email.",
    tone: "bg-blue-600 hover:bg-blue-700",
    done: "The offer was emailed to the club's admins. Nothing changes until they accept it.",
  },
  resume: {
    label: "End hold (back to full plan)",
    confirm: "End the hold now? The club goes back to its old plan and price, with all its features. If it was a yearly plan, Stripe starts a new year now and takes any left-over credit off the charge.",
    tone: "bg-green-600 hover:bg-green-700",
    done: "Done. Stripe confirms in a moment and the club follows.",
  },
  cancel: {
    label: "Cancel subscription",
    confirm: "Cancel this subscription? It ends at the end of the period already paid for, then the club is deactivated. Nothing is deleted: its data is kept (a club can only be deleted by an admin, and only 12 months after it was deactivated).",
    tone: "bg-red-700 hover:bg-red-600",
    done: "Done. Stripe confirms in a moment and the club follows.",
  },
};

export interface OfferInfo {
  id: string;
  kind: string;
  label: string;
  sentOn: string;
  sentTo: string[];
}

// Account hold offer, end hold and cancel. Admins make the change; everyone else sends a request that an
// admin approves on the Approvals page. A hold is never started for the customer: it is an emailed offer
// that only their "yes" turns into a hold.
export default function BillingActionsPanel({
  clubId, clubName, onHold, cancelling, needsApproval, offers,
}: {
  clubId: string;
  clubName: string;
  onHold: boolean;
  cancelling: boolean;
  needsApproval: boolean;
  offers: OfferInfo[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  async function run(action: Action) {
    const verb = needsApproval ? "Send a request to " : "";
    if (!confirm(`${verb}${COPY[action].label.toLowerCase()} for ${clubName}?\n\n${COPY[action].confirm}`)) return;
    setBusy(action);
    setMessage(null);
    const res = await fetch(`/api/clubs/${clubId}/billing-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ text: data.error ?? "That didn't work.", tone: "error" });
      return;
    }
    setReason("");
    setMessage({
      text: res.status === 202 ? "Your request was sent to an admin for approval." : COPY[action].done,
      tone: "ok",
    });
    router.refresh();
  }

  const actions: Action[] = onHold ? ["resume", "cancel"] : cancelling ? ["offer_hold"] : ["offer_hold", "cancel"];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-200">Billing actions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {needsApproval
            ? "These need an admin's approval. Your request goes to the Approvals list and nothing happens until an admin approves it."
            : "These change the customer's subscription in Stripe. An account hold is only an offer: it starts only if the customer accepts."}
        </p>
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
        placeholder="Reason (optional, kept in the Logs)"
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex flex-wrap gap-3">
        {actions.map((a) => (
          <button key={a} type="button" onClick={() => run(a)} disabled={busy !== null}
            className={`${COPY[a].tone} disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors`}>
            {busy === a ? "Working…" : needsApproval ? `Request: ${COPY[a].label.toLowerCase()}` : COPY[a].label}
          </button>
        ))}
      </div>
      {message && <p className={`text-sm ${message.tone === "ok" ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}

      {offers.length > 0 && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Offers sent to the customer</p>
          <ul className="space-y-1.5">
            {offers.map((o) => (
              <li key={o.id} className="text-sm text-slate-300">
                <span className="text-slate-400">{o.kind === "START" ? "Hold offer" : "End-of-hold choice"} · {o.sentOn}</span>
                {" — "}{o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
