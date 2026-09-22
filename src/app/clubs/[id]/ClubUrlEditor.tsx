"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClubUrlEditor({
  clubId, initialSlug, initialSubdomainReady, initialCustomDomain,
}: {
  clubId: string;
  initialSlug: string;
  initialSubdomainReady: boolean;
  initialCustomDomain: string | null;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [slugError, setSlugError] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);

  const [ready, setReady] = useState(initialSubdomainReady);
  const [savingReady, setSavingReady] = useState(false);

  const [customDomain, setCustomDomain] = useState(initialCustomDomain ?? "");
  const [domainError, setDomainError] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Failed to save");
    router.refresh();
    return d;
  }

  async function saveSlug() {
    setSavingSlug(true);
    setSlugError("");
    try {
      await patch({ slug });
    } catch (e) {
      setSlugError(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingSlug(false);
  }

  async function toggleReady() {
    setSavingReady(true);
    const next = !ready;
    try {
      await patch({ subdomainReady: next });
      setReady(next);
    } catch {
      // leave the toggle as-is on failure
    }
    setSavingReady(false);
  }

  async function saveDomain() {
    setSavingDomain(true);
    setDomainError("");
    try {
      await patch({ customDomain: customDomain.trim() || null });
    } catch (e) {
      setDomainError(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingDomain(false);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-6">
      <h2 className="font-semibold text-slate-200">Club URL</h2>

      <div>
        <label htmlFor="club-slug" className="block text-sm font-medium text-slate-300 mb-1">Subdomain</label>
        <div className="flex items-center gap-2">
          <input id="club-slug" value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-sm text-slate-500 whitespace-nowrap">.squadino.com</span>
          <button type="button" onClick={saveSlug} disabled={savingSlug || slug === initialSlug}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap">
            {savingSlug ? "Saving…" : "Save"}
          </button>
        </div>
        {slugError && <p className="text-red-400 text-sm mt-1.5">{slugError}</p>}
        <p className="text-xs text-slate-500 mt-1.5">
          Add the matching DNS record + Vercel domain for <span className="font-mono">{slug || "…"}.squadino.com</span> before
          turning "Subdomain is live" on below — otherwise members get bounced to a dead subdomain.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-700">
        <div>
          <p className="text-sm font-medium text-slate-300">Subdomain is live</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Off = members always sign in at app.squadino.com. On = they're routed to their own subdomain.
          </p>
        </div>
        <button type="button" onClick={toggleReady} disabled={savingReady}
          role="switch" aria-checked={ready}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${ready ? "bg-blue-600" : "bg-slate-600"} disabled:opacity-50`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${ready ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="pt-2 border-t border-slate-700">
        <label htmlFor="club-custom-domain" className="block text-sm font-medium text-slate-300 mb-1">Custom domain</label>
        <p className="text-xs text-slate-500 mb-2">
          Optional. The club's own domain (e.g. a URL they already own) — always redirects to the subdomain above,
          never serves the app directly. Leave blank if they're only using the squadino.com subdomain.
        </p>
        <div className="flex items-center gap-2">
          <input id="club-custom-domain" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="e.g. app.theirclub.com.au"
            className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={saveDomain} disabled={savingDomain || customDomain === (initialCustomDomain ?? "")}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap">
            {savingDomain ? "Saving…" : "Save"}
          </button>
        </div>
        {domainError && <p className="text-red-400 text-sm mt-1.5">{domainError}</p>}
      </div>
    </div>
  );
}
