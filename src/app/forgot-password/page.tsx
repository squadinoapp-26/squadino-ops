"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [mailLive, setMailLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      setMailLive(d.mailConfigured !== false);
      setSent(true);
    } else {
      setError(d.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-5">
        {sent ? (
          <>
            <div className="text-center space-y-1">
              <span className="text-3xl">📧</span>
              <h1 className="text-white font-bold text-lg">Check your inbox</h1>
              <p className="text-slate-400 text-sm">
                If that email is registered, we&apos;ve sent a link to reset your password. It works once and
                expires in an hour.
              </p>
            </div>

            {!mailLive && (
              <div className="bg-amber-950/60 border border-amber-800 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-amber-300 mb-1">⚠️ Email isn&apos;t switched on yet</p>
                <p className="text-xs text-amber-400">
                  No mail provider is configured, so nothing was actually sent. The reset link was written to
                  the server log instead — see the terminal running the app.
                </p>
              </div>
            )}

            <Link href="/login"
              className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <span className="text-3xl">⚡</span>
              <h1 className="text-white font-bold text-lg">Forgotten password</h1>
              <p className="text-slate-400 text-sm">Enter your email and we&apos;ll send you a link to choose a new one.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input type="email" required autoFocus value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400">
              Remembered it? <Link href="/login" className="text-blue-400 hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
