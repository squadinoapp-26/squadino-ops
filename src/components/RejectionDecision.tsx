"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The two things an admin can do about a rejected club:
//  - "request": a moderator's rejection is waiting. Approve it (the signup is rejected for good) or re-instate it
//    (the signup goes back to the ones waiting for review).
//  - "rejected": the signup is already rejected. Re-instate it.
export default function RejectionDecision(props: { kind: "request"; requestId: string } | { kind: "rejected"; signupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reinstate" | null>(null);
  const [error, setError] = useState("");

  async function run(action: "approve" | "reinstate") {
    setBusy(action);
    setError("");
    const res =
      props.kind === "request"
        ? await fetch(`/api/change-requests/${props.requestId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: action === "approve" ? "approve" : "reject" }),
          })
        : await fetch(`/api/signups/${props.signupId}/reinstate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error ?? "That didn't work.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {props.kind === "request" && (
          <button type="button" onClick={() => run("approve")} disabled={busy !== null}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            {busy === "approve" ? "Approving…" : "Approve rejection"}
          </button>
        )}
        <button type="button" onClick={() => run("reinstate")} disabled={busy !== null}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
          {busy === "reinstate" ? "Re-instating…" : "Re-instate"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
