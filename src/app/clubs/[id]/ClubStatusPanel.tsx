"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Club status on /clubs/[id]: Deactivate / Reactivate, and — only
// once a club has been inactive for 12 months — Delete permanently. The
// server makes the same checks; this just shows what's possible.
export default function ClubStatusPanel({
  clubId,
  clubName,
  active,
  deactivatedOn,
  monthsInactive,
  deletableOn,
  neverUsed,
  canDelete,
  canManage,
}: {
  clubId: string;
  clubName: string;
  active: boolean;
  // Dates are formatted on the server, in Melbourne time. Null when an
  // inactive club's date isn't recorded yet (database update not run).
  deactivatedOn: string | null;
  monthsInactive: number | null;
  deletableOn: string | null;
  // Nobody has ever signed in to it, so it can be deleted as soon as it's
  // deactivated instead of waiting 12 months.
  neverUsed: boolean;
  canDelete: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmName, setConfirmName] = useState("");

  async function setActive(next: boolean) {
    const question = next
      ? `Reactivate ${clubName}? Its members will be able to sign in again.`
      : `Deactivate ${clubName}?\n\nEvery member is signed out and can't sign in until it's reactivated. Nothing is deleted. Once it has been inactive for 12 months you'll be offered to delete it for good.`;
    if (!confirm(question)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/clubs/${clubId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't change the club's status.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (confirmName !== clubName) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/clubs/${clubId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete the club.");
    setBusy(false);
  }

  const since = deactivatedOn
    ? `Deactivated on ${deactivatedOn}${monthsInactive ? ` — ${monthsInactive === 1 ? "1 month" : `${monthsInactive} months`} ago` : ""}.`
    : "The date it was deactivated isn't recorded yet — run the database update (db-sync.cmd).";

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-200">Club status</h2>
            {active
              ? <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Active</span>
              : <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Inactive</span>}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {active ? "Members can sign in." : `Members can't sign in. ${since}`}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setActive(!active)} disabled={busy}
            className={`${active ? "bg-slate-700 hover:bg-slate-600" : "bg-green-700 hover:bg-green-600"} disabled:opacity-60 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap`}>
            {active ? "Deactivate club" : "Reactivate club"}
          </button>
        )}
      </div>

      {active && neverUsed && canManage && (
        <p className="text-xs text-slate-500">Nobody has signed in to this club yet, so once it&apos;s deactivated it can be deleted straight away.</p>
      )}

      {!active && !canDelete && deletableOn && (
        <p className="text-xs text-slate-500">{`It can be deleted permanently from ${deletableOn}, 12 months after it was deactivated.`}</p>
      )}

      {canDelete && canManage && (
        <div className="border border-red-500/40 bg-red-950/30 rounded-xl p-5 space-y-3">
          <h3 className="text-red-400 font-semibold text-sm">
            {neverUsed ? "Never used — delete permanently?" : "Inactive for over 12 months — delete permanently?"}
          </h3>
          <p className="text-xs text-slate-400">
            Deletes <span className="font-semibold text-slate-200">{clubName}</span> and{" "}
            <span className="font-semibold text-slate-200">all of its data</span>: every member, wall post, event,
            chat, document, order, roster entry and face-blur profile, and takes its web address off Vercel. This
            can&apos;t be undone. If the club paid through Stripe, make sure its subscription is cancelled there.
          </p>
          <p className="text-xs text-slate-400">
            Type the club name <span className="font-mono text-slate-200">{clubName}</span> to confirm:
          </p>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Type the club name to confirm deletion" placeholder={clubName}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          <button type="button" onClick={remove} disabled={confirmName !== clubName || busy}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
            {busy ? "Deleting…" : "Delete club permanently"}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
