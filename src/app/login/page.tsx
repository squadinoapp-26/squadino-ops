"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Invalid email or password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-5">
        <div className="text-center space-y-1">
          <span className="text-3xl">⚡</span>
          <h1 className="text-white font-bold text-lg">SQUADINO Ops</h1>
          <p className="text-slate-400 text-sm">Platform staff sign in</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
          {loading ? "Signing in…" : "Sign In"}
        </button>
        <p className="text-center text-sm text-slate-400">
          <Link href="/forgot-password" className="text-blue-400 hover:underline font-medium">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}
