"use client";

import { useState } from "react";
import { suggestPassword } from "@/lib/passwordSuggest";

const RESETTABLE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

export interface ClubUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  online: boolean;
  location: string | null;
}

export default function ClubUsersList({ users }: { users: ClubUserRow[] }) {
  const [resettingId, setResettingId] = useState<string | null>(null);

  if (users.length === 0) return <p className="text-slate-500 text-sm">No users yet.</p>;

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div key={user.id} className="py-2 border-b border-slate-700 last:border-0 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold shrink-0">{user.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-medium flex items-center justify-end gap-1.5 ${user.online ? "text-green-400" : "text-slate-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user.online ? "bg-green-400" : "bg-slate-600"}`} />
                {user.online ? "Online" : "Offline"}
              </span>
              {user.location && <p className="text-xs text-slate-500 mt-0.5">{user.location}</p>}
            </div>
            <span className="text-xs text-slate-400">{user.role}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              user.status === "ACTIVE" ? "bg-green-900 text-green-300" :
              user.status === "PENDING" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"
            }`}>{user.status}</span>
            {RESETTABLE_ROLES.has(user.role) && (
              <button onClick={() => setResettingId(resettingId === user.id ? null : user.id)}
                className="text-xs px-3 py-1.5 rounded-full font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors whitespace-nowrap">
                Reset password
              </button>
            )}
          </div>
          {resettingId === user.id && (
            <ResetPasswordInline userId={user.id} onDone={() => setResettingId(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

function ResetPasswordInline({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (password.length < 8) { setError("Enter a password of at least 8 characters."); return; }
    setBusy(true); setError("");
    const res = await fetch(`/api/club-users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setDone(password);
    else setError(d.error ?? "Failed to reset password.");
    setBusy(false);
  }

  if (done) {
    return (
      <div className="bg-green-950/60 border border-green-800 rounded-xl p-3 text-sm text-green-300 space-y-1 ml-11">
        <p className="font-semibold">✓ Password reset — share it with them:</p>
        <p>New password: <span className="font-mono">{done}</span></p>
        <button onClick={onDone} className="text-xs font-medium text-green-400 hover:underline mt-1">Close</button>
      </div>
    );
  }

  return (
    <div className="ml-11 space-y-2">
      <div className="flex gap-2">
        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={() => setPassword(suggestPassword())}
          className="px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium whitespace-nowrap">🎲 Generate</button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy || password.length < 8}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
          {busy ? "Resetting…" : "Set new password"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-slate-400 hover:text-white px-2">Cancel</button>
      </div>
    </div>
  );
}
