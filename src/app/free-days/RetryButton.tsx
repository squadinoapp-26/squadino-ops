"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// An admin finishing free days that were left half done: clubs not reached or that failed, and emails still to send. Safe to press
// again: the club app never gives a club the days twice or sends the same email twice.
export default function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/free-days/${id}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data.error ?? "That didn't work.");
    const s = data.summary as { applied: number; total: number; failed: number; emailProblems: number };
    setMessage(`${s.applied} of ${s.total} clubs done${s.failed ? `, ${s.failed} still not done` : ""}${s.emailProblems ? `, ${s.emailProblems} with an email still to send` : ""}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={busy} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl">
        {busy ? "Finishing…" : "Finish the ones not done"}
      </button>
      {message && <span className="text-sm text-slate-300" role="status">{message}</span>}
    </div>
  );
}
