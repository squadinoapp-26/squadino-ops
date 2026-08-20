"use client";
import { useState } from "react";

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

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-3">
        {users.map(user => (
          <div key={user.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
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
