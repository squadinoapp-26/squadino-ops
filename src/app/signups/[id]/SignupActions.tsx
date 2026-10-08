"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { normaliseSubdomain, subdomainProblem } from "@/lib/subdomain";

export default function SignupActions({
  id,
  needsPaymentCheck,
  canReview,
  canRejectNow,
  suggestedSubdomain,
  rootDomain,
}: {
  id: string;
  // Paid plans: the reviewer confirms they've checked the payment before approving.
  needsPaymentCheck: boolean;
  canReview: boolean;
  // Super admins and admins reject at once; everyone else sends the rejection to an admin to approve.
  canRejectNow: boolean;
  // What the club name would give; the reviewer can shorten it before approving.
  suggestedSubdomain: string;
  rootDomain: string;
}) {
  const router = useRouter();
  const [subdomain, setSubdomain] = useState(suggestedSubdomain);
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const slug = normaliseSubdomain(subdomain);
  const slugProblem = subdomainProblem(slug);

  async function approve() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/signups/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentChecked, slug }),
    });
    if (res.ok) {
      // Straight on to the club, where the subdomain and setup email are done.
      const data = await res.json().catch(() => ({}));
      router.push(data.clubId ? `/clubs/${data.clubId}` : "/signups");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to approve");
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Give a reason for rejecting this signup.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/signups/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      router.push("/signups");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reject");
      setBusy(false);
    }
  }

  if (!canReview) {
    return <p className="text-sm text-slate-400">Only platform admins and moderators can approve or reject signups.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-950 text-red-300 px-3 py-2 text-sm">{error}</p>}
      {!rejecting ? (
        <div className="space-y-4">
        <div>
          <label htmlFor="approve-subdomain" className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5">Web address</label>
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 focus-within:border-slate-500">
            <input id="approve-subdomain" value={subdomain} onChange={(e) => { setSubdomain(e.target.value); setError(""); }}
              onBlur={() => setSubdomain(slug)} spellCheck={false} autoCapitalize="none"
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm font-mono focus:outline-none" />
            <span className="pr-3 text-sm font-mono text-slate-500">.{rootDomain}</span>
          </div>
          <p className={`text-xs mt-1.5 ${slugProblem ? "text-red-400" : "text-slate-500"}`}>
            {slugProblem ?? `Keep it short and easy to type. The club will use ${slug}.${rootDomain}.`}
          </p>
        </div>
        {needsPaymentCheck && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={paymentChecked} onChange={(e) => setPaymentChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">I&apos;ve checked this signup&apos;s payment</span>
          </label>
        )}
        <p className="text-xs text-slate-500">
          Approving creates the club and its owner account. You&apos;ll then set up the subdomain and send the owner their setup email.
        </p>
        <div className="flex gap-3">
          <button
            onClick={approve}
            disabled={busy || !!slugProblem || (needsPaymentCheck && !paymentChecked)}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {busy ? "Approving…" : "Approve & create club"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Reject
          </button>
        </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {canRejectNow
              ? "This rejects the signup straight away. It is then listed under Rejected clubs on the dashboard, where it can be re-instated."
              : "This does not reject the signup yet. Your reason goes to an admin, who approves the rejection or re-instates the signup."}
          </p>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            placeholder="Why is this signup being rejected? (required, internal only)"
            maxLength={500}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex gap-3">
            <button
              onClick={reject}
              disabled={busy || !reason.trim()}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {busy ? (canRejectNow ? "Rejecting…" : "Sending…") : canRejectNow ? "Confirm reject" : "Send to an admin to approve"}
            </button>
            <button
              onClick={() => setRejecting(false)}
              disabled={busy}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
