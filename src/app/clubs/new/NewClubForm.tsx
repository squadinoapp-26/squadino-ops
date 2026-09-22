"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SPORTS = ["Swimming", "Football", "Basketball", "Cricket", "Netball", "Soccer", "Tennis", "Rugby", "Athletics", "Other"];
const ORG_TYPES = ["Club", "School", "Association", "Academy", "League", "Community Group"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);
}

export interface PlanPackage {
  id: string;
  name: string;
  userCap: number | null;
  priceCents: number;
}

export default function NewClubForm({ packages }: { packages: PlanPackage[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("Club");
  const [sports, setSports] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function toggleSport(sport: string) {
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, orgType, sports, slug: slug || undefined, packageId: packageId || null,
          owner: { name: ownerName, email: ownerEmail },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create club");
      router.push(`/clubs/${data.id}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create club");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-200">Organisation</h2>

        <Field label="Organisation name" required>
          <input value={name} onChange={(e) => handleNameChange(e.target.value)} required
            className="input" placeholder="e.g. Wantirna Tennis Club" />
        </Field>

        <Field label="Type">
          <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className="input">
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Sports" required>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <button key={sport} type="button" onClick={() => toggleSport(sport)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  sports.includes(sport)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                }`}>
                {sport}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Subdomain" required>
          <div className="flex items-center gap-2">
            <input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} required
              className="input flex-1" placeholder="wantirnatc" />
            <span className="text-sm text-slate-500 whitespace-nowrap">.squadino.com</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reserved from creation, but only routes members there once its DNS + Vercel custom domain exist and
            &quot;Subdomain is live&quot; is turned on in the club&apos;s editor.
          </p>
        </Field>

        {packages.length > 0 && (
          <Field label="Package">
            <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="input">
              <option value="">No package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.userCap ? `${p.userCap} users` : "unlimited"} · ${(p.priceCents / 100).toFixed(2)}/mo
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-200">Owner account</h2>
        <p className="text-xs text-slate-500">
          They&apos;ll get an email with a link to set their own password before they can sign in.
        </p>
        <Field label="Owner name" required>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required className="input" />
        </Field>
        <Field label="Owner email" required>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required className="input" />
        </Field>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
        {submitting ? "Creating…" : "Create client"}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          background: rgb(51 65 85);
          border: 1px solid rgb(71 85 105);
          color: white;
          border-radius: 0.75rem;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(59 130 246);
        }
      `}</style>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}
