"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESTRICTED_WORD_MAX } from "@/lib/restrictedWords";

type Row = { id: string; word: string };

// The restricted-words list every club gets. The list is long, so it's
// searchable; super admins and admins can add and remove words.
export default function RestrictedWordsManager({ words, canManage }: { words: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setError("");
    setNotice("");
    const res = await fetch("/api/restricted-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Couldn't add that word."); return; }
    setNotice(`Added "${data.word.word}". It now applies to every club.`);
    setWord("");
    router.refresh();
  }

  async function remove(row: Row) {
    if (!confirm(`Remove "${row.word}" from the restricted-words list for every club? Clubs that added it themselves keep it.`)) return;
    setBusy(row.id);
    setError("");
    setNotice("");
    const res = await fetch(`/api/restricted-words/${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Couldn't remove that word."); return; }
    setNotice(`Removed "${row.word}".`);
    router.refresh();
  }

  const q = search.trim().toLowerCase();
  const shown = q ? words.filter((w) => w.word.includes(q)) : words;
  const input = "bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      {canManage ? (
        <form onSubmit={add} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold mb-3">Add a word or phrase</h2>
          <div className="flex flex-wrap gap-3">
            <input aria-label="Word or phrase to restrict" value={word} onChange={(e) => setWord(e.target.value)} maxLength={RESTRICTED_WORD_MAX}
              placeholder="e.g. a word or short phrase" className={`${input} flex-1 min-w-48`} />
            <button type="submit" disabled={busy !== null || !word.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
              {busy === "add" ? "Adding…" : "Add word"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only platform super admins and admins can change this list.</p>
      )}

      {error && <p className="rounded-lg bg-red-950 text-red-300 px-3 py-2 text-sm">{error}</p>}
      {notice && <p className="rounded-lg bg-green-950 text-green-300 px-3 py-2 text-sm">{notice}</p>}

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <input aria-label="Search the list" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…" className={`${input} w-64`} />
          <p className="text-xs text-slate-500">{q ? `${shown.length} of ${words.length} words` : `${words.length} words`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shown.map((w) => (
            <span key={w.id || w.word} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-full pl-3 pr-1.5 py-1 text-sm">
              {w.word}
              {canManage && w.id && (
                <button type="button" onClick={() => remove(w)} disabled={busy !== null} aria-label={`Remove ${w.word}`}
                  className="text-slate-500 hover:text-red-400 disabled:opacity-50 px-1.5 leading-none">
                  {busy === w.id ? "…" : "×"}
                </button>
              )}
            </span>
          ))}
          {shown.length === 0 && <p className="text-sm text-slate-500">No words match.</p>}
        </div>
      </div>
    </div>
  );
}
