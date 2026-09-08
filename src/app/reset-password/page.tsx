"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  // null = still checking the link
  const [valid, setValid] = useState<boolean | null>(null);
  const [form, setForm] = useState({ next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => setValid(r.ok ? (await r.json()).valid : false))
      .catch(() => setValid(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.next.length < 8) { setError("Password must be at least 8 characters"); return; }

    setSaving(true);
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.next }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);

    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      setError(d.error ?? "Could not reset your password.");
    }
  }

  const card = "w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-5";
  const input =
    "w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (valid === null) {
    return <div className={card}><p className="text-center text-slate-400 py-6 text-sm">Checking your link…</p></div>;
  }

  if (!valid) {
    return (
      <div className={card}>
        <div className="text-center space-y-1">
          <span className="text-3xl">⏰</span>
          <h1 className="text-white font-bold text-lg">This link has expired</h1>
          <p className="text-slate-400 text-sm">
            Reset links can only be used once and expire after an hour. Request a new one to continue.
          </p>
        </div>
        <Link href="/forgot-password"
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={card}>
        <div className="text-center space-y-1">
          <span className="text-3xl">✅</span>
          <h1 className="text-white font-bold text-lg">Password updated</h1>
          <p className="text-slate-400 text-sm">You&apos;ve been signed out everywhere. Taking you to sign in…</p>
        </div>
        <Link href="/login"
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="text-center space-y-1">
        <span className="text-3xl">⚡</span>
        <h1 className="text-white font-bold text-lg">Choose a new password</h1>
        <p className="text-slate-400 text-sm">This will sign you out on all your devices.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">New password</label>
          <input type="password" required autoComplete="new-password" value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })} className={input} />
          <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Confirm new password</label>
          <input type="password" required autoComplete="new-password" value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={input} />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button type="submit" disabled={saving || !form.next || !form.confirm}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
          {saving ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
