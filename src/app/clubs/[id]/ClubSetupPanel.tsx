"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The admin's last two steps after approving a signup: switch the club's
// subdomain on (one button — see /api/clubs/[id]/subdomain), then
// email the owner their "set your password" link.
export default function ClubSetupPanel({
  clubId,
  host,
  subdomainReady,
  pendingOwners,
  canManage,
  autoSubdomain,
}: {
  clubId: string;
  host: string;
  subdomainReady: boolean;
  // Admins who have never signed in — who the setup email goes to.
  pendingOwners: string[];
  canManage: boolean;
  // Whether the Vercel API is configured for one-click subdomains.
  autoSubdomain: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"subdomain" | "email" | null>(null);
  const [subdomainMsg, setSubdomainMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  async function setUpSubdomain() {
    setBusy("subdomain");
    setSubdomainMsg(null);
    const res = await fetch(`/api/clubs/${clubId}/subdomain`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (data.status === "ready") {
      router.refresh();
    } else {
      setSubdomainMsg({ text: data.message ?? data.error ?? "Couldn't set up the subdomain.", tone: data.status === "pending" ? "info" : "error" });
    }
  }

  async function sendSetupEmail() {
    setBusy("email");
    setEmailMsg(null);
    const res = await fetch(`/api/clubs/${clubId}/setup-email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setEmailMsg(res.ok
      ? { text: `Sent to ${data.sentTo.join(", ")}.`, tone: "ok" }
      : { text: data.error ?? "Couldn't send the setup email.", tone: "error" });
  }

  const button = "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap";

  return (
    <div className="bg-slate-800 border border-amber-800/60 rounded-2xl p-6">
      <h2 className="font-semibold text-slate-200">Finish setting up this club</h2>
      {!canManage && (
        <p className="text-xs text-slate-500 mt-1">Only platform admins and moderators can do these steps.</p>
      )}

      <ol className="mt-4 space-y-4">
        <li className="flex items-start gap-4">
          <Step n={1} done={subdomainReady} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Set up the subdomain</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{host}</p>
            {!subdomainReady && !autoSubdomain && (
              <p className="text-xs text-slate-500 mt-1">
                One-click setup isn&apos;t configured (VERCEL_API_TOKEN / CLUB_VERCEL_PROJECT_ID). Add the domain in Vercel by hand,
                then tick &quot;Subdomain is live&quot; in the settings below.
              </p>
            )}
            {subdomainMsg && (
              <p className={`text-xs mt-1 ${subdomainMsg.tone === "error" ? "text-red-400" : "text-amber-300"}`}>{subdomainMsg.text}</p>
            )}
          </div>
          {subdomainReady ? (
            <span className="text-xs text-green-400 whitespace-nowrap">Live ✓</span>
          ) : autoSubdomain && (
            <button type="button" onClick={setUpSubdomain} disabled={!canManage || busy !== null} className={button}>
              {busy === "subdomain" ? "Setting up…" : "Set up subdomain"}
            </button>
          )}
        </li>

        <li className="flex items-start gap-4">
          <Step n={2} done={pendingOwners.length === 0} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Send the owner their setup email</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {pendingOwners.length === 0
                ? "The owner has signed in."
                : `A one-time link to set their password, to ${pendingOwners.join(", ")}.${subdomainReady ? "" : " Do step 1 first so the links point at the club's own address."}`}
            </p>
            {emailMsg && (
              <p className={`text-xs mt-1 ${emailMsg.tone === "error" ? "text-red-400" : "text-green-400"}`}>{emailMsg.text}</p>
            )}
          </div>
          {pendingOwners.length > 0 && (
            <button type="button" onClick={sendSetupEmail} disabled={!canManage || busy !== null} className={button}>
              {busy === "email" ? "Sending…" : emailMsg?.tone === "ok" ? "Send again" : "Send setup email"}
            </button>
          )}
        </li>
      </ol>
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
      done ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-300"
    }`}>
      {done ? "✓" : n}
    </span>
  );
}
