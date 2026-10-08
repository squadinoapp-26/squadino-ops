"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { normaliseSubdomain, subdomainProblem } from "@/lib/subdomain";

// What an admin can do about a signup that needs their decision. Whatever they choose, they give a written reason,
// and it is recorded with their name and role.
//  - "reject-request": a moderator wants it rejected. Approve the rejection, or re-instate (turn the request down).
//  - "preapprove-request": a moderator pre-approved it. Approve and create the club (the web address can be changed),
//    or send it back for review.
//  - "rejected": already rejected. Re-instate it.
type Props =
  | { kind: "reject-request"; requestId: string }
  | { kind: "preapprove-request"; requestId: string; slug: string | null; rootDomain: string }
  | { kind: "rejected"; signupId: string };

export default function SignupRequestDecision(props: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [subdomain, setSubdomain] = useState(props.kind === "preapprove-request" ? (props.slug ?? "") : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const slug = normaliseSubdomain(subdomain);
  const slugProblem = props.kind === "preapprove-request" && slug ? subdomainProblem(slug) : null;
  const ready = !!reason.trim() && !slugProblem && busy === null;

  async function send(action: string, url: string, body: Record<string, unknown>) {
    setBusy(action);
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      // A request someone else already decided: show the page as it is now.
      if (res.status === 409) router.refresh();
      return;
    }
    router.refresh();
  }

  const decide = (action: string, decision: "approve" | "reject", extra: Record<string, unknown> = {}) =>
    props.kind === "rejected"
      ? undefined
      : send(action, `/api/change-requests/${props.requestId}`, { decision, note: reason, ...extra });

  const button = "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50";

  return (
    <div className="space-y-2 w-full max-w-md">
      {props.kind === "preapprove-request" && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Web address (you can change it)</label>
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 focus-within:border-slate-500">
            <input value={subdomain} onChange={(e) => { setSubdomain(e.target.value); setError(""); }} onBlur={() => setSubdomain(slug)}
              spellCheck={false} autoCapitalize="none"
              className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-sm font-mono focus:outline-none" />
            <span className="pr-3 text-xs font-mono text-slate-500">.{props.rootDomain}</span>
          </div>
          {slugProblem && <p className="text-xs text-red-400 mt-1">{slugProblem}</p>}
        </div>
      )}
      <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} maxLength={500} rows={2}
        placeholder="Your reason (required, recorded with your name)"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        {props.kind === "reject-request" && (
          <>
            <button type="button" disabled={!ready} onClick={() => decide("approve", "approve")}
              className={`${button} bg-red-700 hover:bg-red-600 text-white`}>
              {busy === "approve" ? "Approving…" : "Approve rejection"}
            </button>
            <button type="button" disabled={!ready} onClick={() => decide("reinstate", "reject")}
              className={`${button} bg-slate-700 hover:bg-slate-600`}>
              {busy === "reinstate" ? "Re-instating…" : "Re-instate"}
            </button>
          </>
        )}
        {props.kind === "preapprove-request" && (
          <>
            <button type="button" disabled={!ready} onClick={() => decide("approve", "approve", { slug })}
              className={`${button} bg-green-600 hover:bg-green-700 text-white`}>
              {busy === "approve" ? "Creating club…" : "Approve & create club"}
            </button>
            <button type="button" disabled={!ready} onClick={() => decide("sendback", "reject")}
              className={`${button} bg-slate-700 hover:bg-slate-600`}>
              {busy === "sendback" ? "Sending back…" : "Send back for review"}
            </button>
          </>
        )}
        {props.kind === "rejected" && (
          <button type="button" disabled={!ready} onClick={() => send("reinstate", `/api/signups/${props.signupId}/reinstate`, { reason })}
            className={`${button} bg-slate-700 hover:bg-slate-600`}>
            {busy === "reinstate" ? "Re-instating…" : "Re-instate"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
