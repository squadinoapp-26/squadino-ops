"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extraMembersMonthlyPrice, removalPreview } from "@/lib/extraMembers";

// Taking extra members off a club (owner, 2026-10-24). Shown only when the club has some. An admin removes them straight away; anyone else
// sends a request an admin approves. Either way a reason is required. Nobody already in the club is removed: the member limit just goes
// down, and the box says so when that leaves the club over its limit.
export default function RemoveExtraMembersPanel({
  clubId, clubName, extraMembers, memberCount, limitNow, needsApproval,
}: {
  clubId: string;
  clubName: string;
  extraMembers: number;
  memberCount: number;
  // The club's member limit now, extras included (null: no limit).
  limitNow: number | null;
  needsApproval: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState("");
  const [reason, setReason] = useState("");
  const [credit, setCredit] = useState(true);
  const [emailClub, setEmailClub] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const n = Number(count);
  const valid = count.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= extraMembers;
  const preview = valid ? removalPreview({ members: n, extrasNow: extraMembers, limitNow, memberCount }) : null;

  async function submit() {
    setError("");
    setNotice("");
    if (!valid) return setError(`Enter a whole number from 1 to ${extraMembers}.`);
    if (!reason.trim()) return setError("Give a reason; it goes in the Logs.");
    if (!needsApproval) {
      const lines = [
        `Remove ${n} extra member${n === 1 ? "" : "s"} from ${clubName}?`,
        "",
        `The Stripe charge goes down by ${extraMembersMonthlyPrice(n)} a month${credit ? " (the unused part of this month is credited)" : " (nothing is credited for this month)"}.`,
        preview?.limitAfter != null ? `The club's member limit goes from ${limitNow} to ${preview.limitAfter}.` : "",
        preview && preview.overBy > 0 ? `The club would be ${preview.overBy} over its new limit. Nobody is removed, but no new members can be added.` : "",
        emailClub ? "The club's admins are emailed." : "Nobody is emailed.",
      ].filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""));
      if (!confirm(lines.join("\n"))) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/extra-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: n, reason: reason.trim(), credit, emailClub }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't remove the extra members.");
        return;
      }
      setNotice(
        res.status === 202
          ? "Your request was sent to an admin. Nothing changes until they approve it."
          : `Done. ${n} extra member${n === 1 ? "" : "s"} removed: Stripe and the club's member limit are updated and the Logs have the details.`,
      );
      setCount("");
      setReason("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Nothing left to remove (the last ones just went, or the club's extras were all taken off before): the box stays so the message above isn't lost.
  if (extraMembers < 1) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-slate-200">Extra members</h2>
        {notice && <p className="rounded-xl bg-green-950 text-green-300 px-3 py-2 text-sm" role="status">{notice}</p>}
        <p className="text-sm text-slate-300">This club has no extra members now.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-200">Extra members</h2>
        <p className="text-sm text-slate-300 mt-1">
          This club has <strong>{extraMembers}</strong> extra member{extraMembers === 1 ? "" : "s"} on top of its package ({extraMembersMonthlyPrice(extraMembers)} a month in Stripe).
          Removing some lowers that charge and the club&apos;s member limit. Nobody already in the club is removed.
        </p>
      </div>

      {needsApproval && (
        <p className="rounded-xl bg-amber-950 text-amber-300 px-3 py-2 text-sm">
          Removing extra members needs an admin&apos;s approval. Sending this makes a request; nothing changes until an admin approves it.
        </p>
      )}
      {notice && <p className="rounded-xl bg-green-950 text-green-300 px-3 py-2 text-sm" role="status">{notice}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="remove-extra-count" className="block text-sm font-medium text-slate-300 mb-1">How many to remove</label>
          <input id="remove-extra-count" type="number" inputMode="numeric" min={1} max={extraMembers} value={count} onChange={(e) => setCount(e.target.value)}
            className="w-32 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="button" onClick={() => setCount(String(extraMembers))}
          className="text-sm text-slate-300 underline hover:text-white px-2 py-2.5 pointer-coarse:min-h-11">
          All {extraMembers}
        </button>
      </div>

      <div>
        <label htmlFor="remove-extra-reason" className="block text-sm font-medium text-slate-300 mb-1">Reason (required, goes in the Logs)</label>
        <input id="remove-extra-reason" type="text" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} className="mt-1" />
          <span>Credit the customer for the unused part of this month (untick for no credit)</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={emailClub} onChange={(e) => setEmailClub(e.target.checked)} className="mt-1" />
          <span>Email the club&apos;s admins (untick for a test club)</span>
        </label>
      </div>

      {preview && (
        <div className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300 space-y-1" aria-live="polite">
          <p>
            The Stripe charge goes down by <strong>{preview.chargeDrop}</strong> a month, to <strong>{preview.extrasAfter > 0 ? `${preview.chargeAfter} a month` : "nothing"}</strong>.
          </p>
          {preview.limitAfter != null && <p>The club&apos;s member limit goes from {limitNow} to <strong>{preview.limitAfter}</strong>.</p>}
          {preview.overBy > 0 && (
            <p className="text-amber-300">
              The club has {memberCount} members, which would be {preview.overBy} over the new limit. Nobody is removed, but no new members can be added until it is under the limit.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-300 text-sm" role="alert">{error}</p>}

      <button type="button" onClick={submit} disabled={busy}
        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl pointer-coarse:min-h-11">
        {busy ? "Working…" : needsApproval ? "Send request" : `Remove${valid ? ` ${n}` : ""} extra member${valid && n === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
