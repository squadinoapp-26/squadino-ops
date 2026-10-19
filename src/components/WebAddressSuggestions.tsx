"use client";
import type { SubdomainSuggestion } from "@/lib/subdomain";

// The short web addresses offered under a "Web address" box (see suggestSubdomains in src/lib/subdomain.ts).
// One tap fills the box. An address that another club already uses is shown crossed out and can't be picked.
export default function WebAddressSuggestions({
  suggestions,
  taken = [],
  current,
  rootDomain,
  onPick,
}: {
  suggestions: SubdomainSuggestion[];
  taken?: string[];
  current: string;
  rootDomain: string;
  onPick: (slug: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Suggested web addresses">
      <span className="text-xs text-slate-500">Suggestions:</span>
      {suggestions.map((s) => {
        const isTaken = taken.includes(s.slug);
        const selected = s.slug === current;
        return (
          <button
            key={s.slug}
            type="button"
            disabled={isTaken}
            onClick={() => onPick(s.slug)}
            aria-label={isTaken ? `${s.slug}.${rootDomain} (${s.label}) is already taken` : `Use ${s.slug}.${rootDomain} (${s.label})`}
            aria-pressed={selected}
            className={`rounded-lg border px-2.5 py-1 text-xs font-mono transition-colors ${
              isTaken
                ? "border-slate-700 text-slate-600 line-through cursor-not-allowed"
                : selected
                  ? "border-blue-500 bg-blue-950 text-blue-200"
                  : "border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
            }`}
          >
            {s.slug}
            <span className="ml-1.5 font-sans text-slate-500 no-underline">{isTaken ? "taken" : s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
