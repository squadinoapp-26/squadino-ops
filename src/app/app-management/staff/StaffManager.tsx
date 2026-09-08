"use client";
import { useState } from "react";
import { suggestPassword } from "@/lib/passwordSuggest";

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER_CARE"];
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", MODERATOR: "Moderator", CUSTOMER_CARE: "Customer Care",
};

interface StaffUser { id: string; name: string; email: string; role: string; active: boolean; createdAt: string }

export default function StaffManager({ initialUsers, currentUserId }: { initialUsers: StaffUser[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CUSTOMER_CARE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (res.ok) {
      const user = await res.json();
      setUsers(prev => [...prev, user]);
      setName(""); setEmail(""); setPassword(""); setRole("CUSTOMER_CARE");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add staff");
    }
    setSaving(false);
  }

  async function toggleActive(user: StaffUser) {
    const res = await fetch(`/api/staff/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u));
    }
  }

  async function changeRole(user: StaffUser, newRole: string) {
    const res = await fetch(`/api/staff/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    }
  }

  const [resettingId, setResettingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-3">
        {users.map(user => (
          <div key={user.id} className="py-2 border-b border-slate-700 last:border-0 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold shrink-0">{user.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{user.name}{user.id === currentUserId && <span className="text-xs text-slate-500"> (you)</span>}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
              <select value={user.role} disabled={user.id === currentUserId} onChange={e => changeRole(user, e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs disabled:opacity-50">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button onClick={() => toggleActive(user)} disabled={user.id === currentUserId}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
                  user.active ? "bg-green-900 text-green-300 hover:bg-red-900 hover:text-red-300" : "bg-red-900 text-red-300 hover:bg-green-900 hover:text-green-300"
                }`}>
                {user.active ? "Active" : "Deactivated"}
              </button>
              <button onClick={() => setResettingId(resettingId === user.id ? null : user.id)}
                className="text-xs px-3 py-1.5 rounded-full font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                Reset password
              </button>
            </div>
            {resettingId === user.id && (
              <ResetPasswordInline userId={user.id} onDone={() => setResettingId(null)} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-sm text-slate-200">Add Staff</h2>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" required placeholder="Name" value={name} onChange={e => setName(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" required minLength={8} placeholder="Temporary password" value={password} onChange={e => setPassword(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          {saving ? "Adding…" : "Add Staff"}
        </button>
      </form>
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
    const res = await fetch(`/api/staff/${userId}/reset-password`, {
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
      <div className="bg-green-950/60 border border-green-800 rounded-xl p-3 text-sm text-green-300 space-y-1 ml-12">
        <p className="font-semibold">✓ Password reset — share it with them:</p>
        <p>New password: <span className="font-mono">{done}</span></p>
        <button onClick={onDone} className="text-xs font-medium text-green-400 hover:underline mt-1">Close</button>
      </div>
    );
  }

  return (
    <div className="ml-12 space-y-2">
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
