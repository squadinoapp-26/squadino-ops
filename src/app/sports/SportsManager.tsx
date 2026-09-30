"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_NAME_MAX } from "@/lib/sportCatalog";

type Row = { id: string; name: string; icon: string; clubs: number };

export default function SportsManager({ sports, canManage }: { sports: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setError("");
    const res = await fetch("/api/sports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Couldn't add that sport."); return; }
    setName("");
    setIcon("");
    router.refresh();
  }

  async function remove(row: Row) {
    const note = row.clubs > 0 ? ` ${row.clubs} club${row.clubs === 1 ? "" : "s"} running it will keep it.` : "";
    if (!confirm(`Remove ${row.name} from the sports list?${note}`)) return;
    setBusy(row.id);
    setError("");
    const res = await fetch(`/api/sports/${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Couldn't remove that sport."); return; }
    router.refresh();
  }

  const input = "bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      {canManage ? (
        <form onSubmit={add} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold mb-3">Add a sport</h2>
          <div className="flex flex-wrap gap-3">
            <input aria-label="Sport name" value={name} onChange={(e) => setName(e.target.value)} maxLength={SPORT_NAME_MAX}
              placeholder="e.g. Ultimate Frisbee" className={`${input} flex-1 min-w-48`} />
            <input aria-label="Icon (optional emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={16}
              placeholder="Icon, e.g. 🥏 (optional)" className={`${input} w-52`} />
            <button type="submit" disabled={busy !== null || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
              {busy === "add" ? "Adding…" : "Add sport"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only platform super admins and admins can change this list.</p>
      )}

      {error && <p className="rounded-lg bg-red-950 text-red-300 px-3 py-2 text-sm">{error}</p>}

      <div className="bg-slate-800 border border-slate-700 rounded-2xl divide-y divide-slate-700">
        {sports.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3">
            <span className="text-xl w-7 text-center">{s.icon}</span>
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <span className="text-xs text-slate-500">{s.clubs} club{s.clubs === 1 ? "" : "s"}</span>
            {canManage && (
              <button type="button" onClick={() => remove(s)} disabled={busy !== null} aria-label={`Remove ${s.name}`}
                className="text-xs text-slate-400 hover:text-red-400 disabled:opacity-50 px-2 py-1">
                {busy === s.id ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{sports.length} sports</p>
    </div>
  );
}
