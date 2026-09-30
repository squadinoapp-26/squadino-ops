"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SIGNUP_PACKAGES, SIGNUP_INTERVALS, getSignupPackage } from "@/lib/signupPackages";
import { ORG_TYPES, packageChangeWarnings, type SignupEditData, type SignupPaymentKind } from "@/lib/signupEdit";

type Form = Omit<SignupEditData, "appVersion" | "estimatedUsers" | "trialDays" | "registeredName" | "street" | "suburb" | "postcode" | "requestedUrl" | "contactPhone"> & {
  estimatedUsers: string;
  trialDays: string;
  registeredName: string;
  street: string;
  suburb: string;
  postcode: string;
  requestedUrl: string;
  contactPhone: string;
};

const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-slate-500";

// Wraps the signup's read-only details (passed as children) with an "Edit
// details" button that swaps them for a form. Saving sends only the form's
// values; the server works out what changed and stamps it in the Logs.
export default function SignupEditor({
  id,
  signup,
  sportOptions,
  paymentKind,
  children,
}: {
  id: string;
  signup: Omit<SignupEditData, "appVersion">;
  // The platform sports list plus any sport this signup already has.
  sportOptions: string[];
  paymentKind: SignupPaymentKind;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const initial: Form = {
    ...signup,
    estimatedUsers: String(signup.estimatedUsers),
    trialDays: String(signup.trialDays),
    registeredName: signup.registeredName ?? "",
    street: signup.street ?? "",
    suburb: signup.suburb ?? "",
    postcode: signup.postcode ?? "",
    requestedUrl: signup.requestedUrl ?? "",
    contactPhone: signup.contactPhone ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pkg = getSignupPackage(form.packageKey);
  const packageOptions = pkg ? SIGNUP_PACKAGES : [...SIGNUP_PACKAGES, { key: form.packageKey, name: form.packageKey }];
  const orgOptions = ORG_TYPES.includes(signup.orgType) ? ORG_TYPES : [...ORG_TYPES, signup.orgType];
  const warnings = packageChangeWarnings(paymentKind, signup, form);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSport(name: string) {
    setForm((prev) => ({
      ...prev,
      sports: prev.sports.includes(name) ? prev.sports.filter((s) => s !== name) : [...prev.sports, name],
    }));
  }

  function cancel() {
    setForm(initial);
    setError("");
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/signups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save the changes.");
      return;
    }
    setEditing(false);
    setNotice(data.changed ? `Saved. ${data.changed === 1 ? "1 change" : `${data.changed} changes`} recorded in the Logs.` : "Nothing had changed.");
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {notice && <p className="rounded-lg bg-green-950 text-green-300 px-3 py-2 text-sm">{notice}</p>}
        <div className="relative">
          {children}
          <button
            type="button"
            onClick={() => { setNotice(""); setForm(initial); setEditing(true); }}
            className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-xl transition-colors"
          >
            Edit details
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Edit signup details</h2>
        <p className="text-xs text-slate-500 mt-0.5">Every change is recorded in the Logs with who made it and the old and new values.</p>
      </div>

      <Section title="Package">
        <div className="grid sm:grid-cols-3 gap-3">
          <Labelled label="Package" htmlFor="edit-package">
            <select id="edit-package" value={form.packageKey} onChange={(e) => set("packageKey", e.target.value)} className={inputClass}>
              {packageOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </Labelled>
          <Labelled label="Billing" htmlFor="edit-interval">
            <select id="edit-interval" value={pkg?.fixedInterval ? "monthly" : form.interval} disabled={pkg?.fixedInterval}
              onChange={(e) => set("interval", e.target.value)} className={`${inputClass} disabled:opacity-50`}>
              {SIGNUP_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Labelled>
          <Labelled label="Trial days" htmlFor="edit-trial">
            <input id="edit-trial" type="number" min={0} max={365} value={form.trialDays}
              onChange={(e) => set("trialDays", e.target.value)} className={inputClass} />
          </Labelled>
        </div>
        {pkg?.fixedInterval && <p className="text-xs text-slate-500">Free Trial has no billing choice.</p>}
        {warnings.map((w) => (
          <p key={w} className="rounded-lg bg-amber-950 text-amber-300 px-3 py-2 text-sm">{w}</p>
        ))}
      </Section>

      <Section title="Club">
        <div className="grid sm:grid-cols-2 gap-3">
          <Labelled label="Club / organisation name" htmlFor="edit-club-name">
            <input id="edit-club-name" value={form.clubName} onChange={(e) => set("clubName", e.target.value)} className={inputClass} required />
          </Labelled>
          <Labelled label="Registered name" htmlFor="edit-registered-name">
            <input id="edit-registered-name" value={form.registeredName} placeholder="Same as club name"
              onChange={(e) => set("registeredName", e.target.value)} className={inputClass} />
          </Labelled>
          <Labelled label="Organisation type" htmlFor="edit-org-type">
            <select id="edit-org-type" value={form.orgType} onChange={(e) => set("orgType", e.target.value)} className={inputClass}>
              {orgOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Labelled>
          <Labelled label="Estimated users" htmlFor="edit-users">
            <input id="edit-users" type="number" min={1} value={form.estimatedUsers}
              onChange={(e) => set("estimatedUsers", e.target.value)} className={inputClass} />
          </Labelled>
          <Labelled label="Requested URL" htmlFor="edit-url">
            <input id="edit-url" value={form.requestedUrl} placeholder="None requested"
              onChange={(e) => set("requestedUrl", e.target.value)} className={inputClass} />
          </Labelled>
        </div>
        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Sports</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl p-3">
            {sportOptions.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.sports.includes(s)} onChange={() => toggleSport(s)} className="w-4 h-4 rounded" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Address">
        <div className="grid sm:grid-cols-3 gap-3">
          <Labelled label="Street" htmlFor="edit-street">
            <input id="edit-street" value={form.street} onChange={(e) => set("street", e.target.value)} className={inputClass} />
          </Labelled>
          <Labelled label="Suburb" htmlFor="edit-suburb">
            <input id="edit-suburb" value={form.suburb} onChange={(e) => set("suburb", e.target.value)} className={inputClass} />
          </Labelled>
          <Labelled label="Postcode" htmlFor="edit-postcode">
            <input id="edit-postcode" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} className={inputClass} />
          </Labelled>
        </div>
      </Section>

      <Section title="Primary contact">
        <div className="grid sm:grid-cols-3 gap-3">
          <Labelled label="Contact name" htmlFor="edit-contact-name">
            <input id="edit-contact-name" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputClass} required />
          </Labelled>
          <Labelled label="Contact email" htmlFor="edit-contact-email">
            <input id="edit-contact-email" type="email" value={form.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)} className={inputClass} required />
          </Labelled>
          <Labelled label="Contact phone" htmlFor="edit-contact-phone">
            <input id="edit-contact-phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputClass} />
          </Labelled>
        </div>
      </Section>

      {error && <p className="rounded-lg bg-red-950 text-red-300 px-3 py-2 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={cancel} disabled={saving}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

function Labelled({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
