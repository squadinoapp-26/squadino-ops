"use client";
import { useState } from "react";
import { blockedText, holderLabel, type Holder } from "@/lib/clubAccess";
import { useClubWatch } from "./useClubWatch";

// For admins, at the top of a club's page: whether a customer care officer or moderator has this account open. Admins are never held
// back, and the officer stays in unless the admin presses "Take over", which ends the officer's access at once (written to the Logs).
export default function ClubPresencePanel({
  clubId, clubName, enabled, holder,
}: {
  clubId: string;
  clubName: string;
  enabled: boolean;
  holder: Holder | null;
}) {
  const [watch, setWatch] = useClubWatch(clubId, { enabled, holder });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function takeOver() {
    if (!watch.holder) return;
    const who = holderLabel(watch.holder);
    if (!confirm(`Take over ${clubName}?\n\n${who} will be stopped at once and can't make changes to this account. Their page will tell them it has ended. This is written to the Logs.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/clubs/${clubId}/access/take-over`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't take over the account.");
        return;
      }
      setWatch({ enabled: true, holder: null });
      setMessage(body.tookFrom ? `You took over from ${holderLabel(body.tookFrom)}. They have been stopped.` : "Nobody was in the account any more.");
    } catch {
      setError("Couldn't take over the account. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!watch.enabled) {
    return (
      <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-4 text-sm text-amber-100">
        <p className="font-semibold">One-person-per-account locking is not switched on yet</p>
        <p className="mt-1">The database update for it hasn&apos;t been run, so customer care officers and moderators can open the same account together. Run the update (docs/claude/neon-club-access-locks.sql) to switch it on.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {watch.holder ? (
        <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <p className="font-semibold text-sm text-amber-100">Someone else is in this account</p>
            <p className="text-sm text-amber-100">{blockedText(watch.holder)} They can keep working unless you take over.</p>
          </div>
          <button type="button" onClick={takeOver} disabled={busy}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm pointer-coarse:min-h-11">
            {busy ? "Taking over…" : "Take over"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-300">No customer care officer or moderator has this account open right now.</p>
      )}
      {message && <p className="text-sm text-green-300">{message}</p>}
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
