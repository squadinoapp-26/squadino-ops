"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "start_hold" | "resume" | "cancel";

const COPY: Record<Action, { label: string; confirm: string; tone: string }> = {
  start_hold: {
    label: "Put on account hold",
    confirm: "Put this club on hold? It moves to the $50/month hold price for up to 3 months. Monthly customers pay $50 from their next invoice; yearly customers are credited for the unused part of their year and start paying $50/month straight away, from that credit. Wall, Chat, Training and Stats are switched off and no new members can be added; everything else keeps working and no data is touched. After 3 months it returns to its old plan automatically.",
    tone: "bg-blue-600 hover:bg-blue-700",
  },
  resume: {
    label: "End hold (back to full plan)",
    confirm: "End the hold now? The club goes back to its old plan and price, with all its features. If it was a yearly plan, Stripe starts a new year now and takes any left-over credit off the charge.",
    tone: "bg-green-600 hover:bg-green-700",
  },
  cancel: {
    label: "Cancel subscription",
    confirm: "Cancel this subscription? It ends at the end of the period already paid for, then the club is deactivated. Nothing is deleted: its data is kept (a club can only be deleted by an admin, and only 12 months after it was deactivated).",
    tone: "bg-red-700 hover:bg-red-600",
  },
};

// Account hold, resume and cancel. Admins make the change; everyone else sends a request that an
// admin approves on the Approvals page.
export default function BillingActionsPanel({
  clubId, clubName, onHold, cancelling, needsApproval,
}: {
  clubId: string;
  clubName: string;
  onHold: boolean;
  cancelling: boolean;
  needsApproval: boolean;
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
      text: res.status === 202
        ? "Your request was sent to an admin for approval."
        : "Done. Stripe confirms in a moment and the club follows.",
      tone: "ok",
    });
    router.refresh();
  }

  const actions: Action[] = onHold ? ["resume", "cancel"] : cancelling ? ["start_hold"] : ["start_hold", "cancel"];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-200">Billing actions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {needsApproval
            ? "These need an admin's approval. Your request goes to the Approvals list and nothing changes until an admin approves it."
            : "These change the customer's subscription in Stripe."}
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
    </div>
  );
}
