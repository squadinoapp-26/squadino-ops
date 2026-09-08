"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PlanPackage {
  id: string;
  name: string;
  userCap: number | null;
  priceCents: number;
  active: boolean;
}

export default function ClubPlanEditor({
  clubId, packages, currentPackageId, userCapOverride, userCount,
}: {
  clubId: string;
  packages: PlanPackage[];
  currentPackageId: string | null;
  userCapOverride: number | null;
  userCount: number;
}) {
  const router = useRouter();
  const [packageId, setPackageId] = useState(currentPackageId ?? "");
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageError, setPackageError] = useState("");

  const [overrideInput, setOverrideInput] = useState(userCapOverride != null ? String(userCapOverride) : "");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  const currentPackage = packages.find((p) => p.id === currentPackageId) ?? null;
  const effectiveCap = userCapOverride ?? currentPackage?.userCap ?? null;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Failed to save");
    router.refresh();
  }

  async function savePackage() {
    setSavingPackage(true);
    setPackageError("");
    try {
      await patch({ packageId: packageId || null });
    } catch (e) {
      setPackageError(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingPackage(false);
  }

  async function saveOverride() {
    const trimmed = overrideInput.trim();
    if (!trimmed) {
      setOverrideError("Enter a number, or use Clear to remove the override");
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1) {
      setOverrideError("Enter a positive whole number");
      return;
    }
    setSavingOverride(true);
    setOverrideError("");
    try {
      await patch({ userCapOverride: n });
    } catch (e) {
      setOverrideError(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingOverride(false);
  }

  async function clearOverride() {
    setSavingOverride(true);
    setOverrideError("");
    try {
      await patch({ userCapOverride: null });
      setOverrideInput("");
    } catch (e) {
      setOverrideError(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingOverride(false);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-6">
      <h2 className="font-semibold text-slate-200">Plan &amp; User Limit</h2>

      <div>
        <label htmlFor="club-package" className="block text-sm font-medium text-slate-300 mb-1">Package</label>
        <div className="flex gap-2">
          <select id="club-package" value={packageId} onChange={(e) => setPackageId(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">No package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.userCap ? `${p.userCap} users` : "unlimited"} · ${(p.priceCents / 100).toFixed(2)}/mo
                {!p.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={savePackage} disabled={savingPackage || packageId === (currentPackageId ?? "")}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap">
            {savingPackage ? "Saving…" : "Save"}
          </button>
        </div>
        {packageError && <p className="text-red-400 text-sm mt-1.5">{packageError}</p>}
      </div>

      <div className="pt-2 border-t border-slate-700">
        <label htmlFor="club-user-cap-override" className="block text-sm font-medium text-slate-300 mb-1">
          User limit override
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Grant (or restrict) this club a different member limit without switching its package.
          {currentPackage && ` Its plan's own limit is ${currentPackage.userCap ?? "unlimited"}.`}
        </p>
        <div className="flex gap-2">
          <input id="club-user-cap-override" type="number" min={1} value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            placeholder="No override — use plan limit"
            className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={saveOverride} disabled={savingOverride}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap">
            {savingOverride ? "Saving…" : "Save"}
          </button>
          {userCapOverride != null && (
            <button type="button" onClick={clearOverride} disabled={savingOverride}
              className="text-sm text-slate-400 hover:text-white px-3 disabled:opacity-50">
              Clear
            </button>
          )}
        </div>
        {overrideError && <p className="text-red-400 text-sm mt-1.5">{overrideError}</p>}
      </div>

      <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
        <span className="text-slate-400">Effective limit</span>
        <span className={`font-semibold ${effectiveCap != null && userCount > effectiveCap ? "text-red-400" : "text-slate-200"}`}>
          {userCount} / {effectiveCap ?? "unlimited"} users
          {userCapOverride != null && <span className="text-blue-400 font-normal"> (override)</span>}
        </span>
      </div>
    </div>
  );
}
