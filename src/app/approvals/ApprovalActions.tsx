"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalActions({ id, type }: { id: string; type?: string }) {
  // New-signup requests are always decided with a written reason; for "reject this signup" approving makes the rejection
  // final and turning it down puts the signup back in the queue, for a pre-approval approving creates the club.
  const signupReject = type === "SIGNUP_REJECT";
  const preapprove = type === "SIGNUP_PREAPPROVE";
  const noteRequired = signupReject || preapprove;
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError("");
    const res = await fetch(`/api/change-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
        placeholder={noteRequired ? "Your reason (required, recorded with your name)" : "Note (optional, shown to the team)"}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex gap-3">
        <button type="button" onClick={() => decide("approve")} disabled={busy !== null || (noteRequired && !note.trim())}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
          {busy === "approve" ? "Approving…" : signupReject ? "Approve rejection" : preapprove ? "Approve & create club" : "Approve and apply"}
        </button>
        <button type="button" onClick={() => decide("reject")} disabled={busy !== null || (noteRequired && !note.trim())}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
          {busy === "reject" ? (signupReject ? "Re-instating…" : preapprove ? "Sending back…" : "Rejecting…") : signupReject ? "Re-instate signup" : preapprove ? "Send back for review" : "Reject"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
