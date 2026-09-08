"use client";
import { useState } from "react";

interface PackageRow {
  id: string; key: string; name: string; userCap: number | null; priceCents: number;
  trialDays: number | null; active: boolean; sortOrder: number; clubCount: number;
}

function dollars(cents: number) { return (cents / 100).toFixed(2); }

// 5% annual-billing discount — must match Website/src/lib/packages.ts
// (yearlyPriceCents) and scripts/create-stripe-products.mjs exactly, since
// this is purely a preview: the actual yearly charge is whatever Stripe
// Price object the marketing site is configured to use. Never editable
// here — always derived from the monthly price so the two can't drift.
function yearlyCents(monthlyCents: number) { return Math.round(monthlyCents * 12 * 0.95); }

export default function PackagesManager({ initial }: { initial: PackageRow[] }) {
  const [packages, setPackages] = useState(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save(pkg: PackageRow) {
    setSavingId(pkg.id);
    setError("");
    const res = await fetch(`/api/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pkg.name, userCap: pkg.userCap, priceCents: pkg.priceCents,
        trialDays: pkg.trialDays, active: pkg.active,
      }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to save"); }
    setSavingId(null);
  }

  async function remove(pkg: PackageRow) {
    if (pkg.clubCount > 0) return;
    if (!confirm(`Delete "${pkg.name}"? This can't be undone.`)) return;
    setSavingId(pkg.id);
    const res = await fetch(`/api/packages/${pkg.id}`, { method: "DELETE" });
    if (res.ok) setPackages(prev => prev.filter(p => p.id !== pkg.id));
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to delete"); }
    setSavingId(null);
  }

  function update(id: string, patch: Partial<PackageRow>) {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="space-y-3">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500">{pkg.key}</span>
              <span className="text-xs text-slate-500">{pkg.clubCount} client{pkg.clubCount === 1 ? "" : "s"} on this package</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Field label="Name">
                <input value={pkg.name} onChange={e => update(pkg.id, { name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="User cap">
                <input type="number" min={1} value={pkg.userCap ?? ""} placeholder="Unlimited"
                  onChange={e => update(pkg.id, { userCap: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Price / mo (AUD)">
                <input type="number" min={0} step={0.01} value={dollars(pkg.priceCents)}
                  onChange={e => update(pkg.id, { priceCents: Math.round(Number(e.target.value || 0) * 100) })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Price / yr (auto, -5%)">
                <input readOnly disabled value={`$${dollars(yearlyCents(pkg.priceCents))}`}
                  title="Computed automatically — monthly x 12 x 0.95. Not editable here; change the monthly price instead."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
              </Field>
              <Field label="Trial (days)">
                <input type="number" min={0} value={pkg.trialDays ?? ""} placeholder="No trial"
                  onChange={e => update(pkg.id, { trialDays: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>
            {pkg.priceCents > 0 && (
              <p className="text-xs text-slate-500">
                Yearly billing = ${dollars(yearlyCents(pkg.priceCents))}/yr (${dollars(Math.round(yearlyCents(pkg.priceCents) / 12))}/mo equivalent) —
                saves ${dollars(pkg.priceCents * 12 - yearlyCents(pkg.priceCents))}/yr vs. paying monthly.
              </p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={pkg.active} onChange={e => update(pkg.id, { active: e.target.checked })} />
                Active (selectable for new/existing clients)
              </label>
              <div className="flex items-center gap-2">
                {pkg.clubCount === 0 && (
                  <button onClick={() => remove(pkg)} disabled={savingId === pkg.id}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5">Delete</button>
                )}
                <button onClick={() => save(pkg)} disabled={savingId === pkg.id}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white px-4 py-1.5 rounded-lg">
                  {savingId === pkg.id ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <NewPackageForm nextSortOrder={packages.length ? Math.max(...packages.map(p => p.sortOrder)) + 1 : 0}
        onCreated={(pkg) => setPackages(prev => [...prev, { ...pkg, clubCount: 0 }])} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function NewPackageForm({ nextSortOrder, onCreated }: { nextSortOrder: number; onCreated: (pkg: PackageRow) => void }) {
  const [name, setName] = useState("");
  const [userCap, setUserCap] = useState("");
  const [price, setPrice] = useState("0");
  const [trialDays, setTrialDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        userCap: userCap ? Number(userCap) : null,
        priceCents: Math.round(Number(price || 0) * 100),
        trialDays: trialDays ? Number(trialDays) : null,
        sortOrder: nextSortOrder,
      }),
    });
    if (res.ok) {
      const pkg = await res.json();
      onCreated(pkg);
      setName(""); setUserCap(""); setPrice("0"); setTrialDays("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to create package");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-sm text-slate-200">New Package</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Field label="Name">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pro"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="User cap">
          <input type="number" min={1} value={userCap} onChange={e => setUserCap(e.target.value)} placeholder="Unlimited"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Price / mo (AUD)">
          <input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Price / yr (auto, -5%)">
          <input readOnly disabled value={`$${dollars(yearlyCents(Math.round(Number(price || 0) * 100)))}`}
            className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
        </Field>
        <Field label="Trial (days)">
          <input type="number" min={0} value={trialDays} onChange={e => setTrialDays(e.target.value)} placeholder="No trial"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
        </Field>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
        {saving ? "Creating…" : "Create Package"}
      </button>
    </form>
  );
}
