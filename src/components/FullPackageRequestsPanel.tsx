"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dollarsToCents, formatMoney, fullPeriodCents, fullQuoteProblem } from "@/lib/fullPackage";
import type { FullRequestItem } from "@/lib/fullPackage.server";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });
const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium" });

const inputClass =
  "bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// The dashboard's "Full package requests" box, for admins and super admins only. Full is for more than 1,000
// members and is priced per member: the admin enters the number of members and the price per member per month,
// sees what will be due, and sends the invoice (created in Stripe by the club app). Once the customer pays, the
// request shows up as a normal signup for the usual review.
export default function FullPackageRequestsPanel({ items }: { items: FullRequestItem[] }) {
  const waiting = items.filter((i) => i.status !== "QUOTED");
  const invoiced = items.filter((i) => i.status === "QUOTED");
  return (
    <div className="bg-slate-800 border border-rose-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Full package requests</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            For more than 1,000 members, priced per member. Enter the number of members and the price per member per
            month: the app works out what is due and sends the customer a Stripe invoice. When they pay, the club
            appears in Signups for the usual review.
          </p>
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full bg-rose-900 text-rose-300 whitespace-nowrap">
          {`${waiting.length} to price · ${invoiced.length} invoiced`}
        </span>
      </div>

      {waiting.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Waiting for a price</h3>
          <ul className="mt-2 divide-y divide-slate-700 max-h-[34rem] overflow-y-auto pr-2">
            {waiting.map((r) => <PriceRow key={r.id} item={r} />)}
          </ul>
        </>
      )}
      {invoiced.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice sent, waiting for payment</h3>
          <ul className="mt-2 divide-y divide-slate-700 max-h-[28rem] overflow-y-auto pr-2">
            {invoiced.map((r) => <InvoicedRow key={r.id} item={r} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function Who({ item }: { item: FullRequestItem }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{item.clubName}</p>
      {item.registeredName && <p className="text-xs text-slate-500">{`Registered as ${item.registeredName}`}</p>}
      <p className="text-xs text-slate-400 mt-0.5">
        {`${item.contactName} (${item.contactEmail}${item.contactPhone ? `, ${item.contactPhone}` : ""}) · ${item.orgType} · ${item.sports.join(", ")}`}
      </p>
      <p className="text-xs text-slate-400">{`Asked ${when.format(new Date(item.createdAt))} · expects about ${item.estimatedUsers.toLocaleString("en-AU")} members · wants to pay ${item.interval}`}</p>
    </div>
  );
}

async function send(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/full-requests/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res || !res.ok) return data?.error ?? "Couldn't reach the server. Try again.";
  return null;
}

function PriceRow({ item }: { item: FullRequestItem }) {
  const router = useRouter();
  const [users, setUsers] = useState(item.estimatedUsers >= 1001 ? String(item.estimatedUsers) : "");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"send" | "close" | null>(null);
  const [error, setError] = useState("");

  // The same sums the invoice is made from, shown as the admin types.
  const usersNum = Number(users.replace(/,/g, "").trim());
  const perMemberCents = dollarsToCents(price);
  const problem = users.trim() && price.trim() ? (perMemberCents === null ? "Enter the price per member in dollars, such as 0.30." : fullQuoteProblem(usersNum, perMemberCents)) : null;
  const ready = users.trim() !== "" && perMemberCents !== null && !problem;
  const monthly = ready ? usersNum * perMemberCents : 0;
  const due = ready ? fullPeriodCents(usersNum, perMemberCents, item.interval) : 0;

  async function run(action: "send_invoice" | "close") {
    if (action === "send_invoice" && ready) {
      const ok = window.confirm(
        `Send ${item.clubName} an invoice for ${formatMoney(due)} (${item.interval})?\n\n${usersNum.toLocaleString("en-AU")} members at ${formatMoney(perMemberCents!)} per member per month. They will be emailed the invoice straight away.`,
      );
      if (!ok) return;
    }
    setBusy(action === "send_invoice" ? "send" : "close");
    setError("");
    const message = await send(item.id, { action, users, price, note });
    if (message) {
      setError(message);
      setBusy(null);
      return;
    }
    router.refresh();
  }

  if (item.status === "PROCESSING") {
    return (
      <li className="py-4 space-y-2">
        <Who item={item} />
        <p className="text-sm text-amber-300">An invoice is being created in Stripe. If this stays here for more than a few minutes, refresh and try again.</p>
      </li>
    );
  }

  return (
    <li className="py-4 space-y-3">
      <Who item={item} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Number of members
          <input value={users} onChange={(e) => setUsers(e.target.value)} inputMode="numeric" placeholder="e.g. 1200" aria-label={`Number of members for ${item.clubName}`} className={`${inputClass} mt-1 block w-40`} />
        </label>
        <label className="text-xs text-slate-400">
          Price per member, per month ($)
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 0.30" aria-label={`Price per member for ${item.clubName}`} className={`${inputClass} mt-1 block w-44`} />
        </label>
      </div>
      <p className="text-sm" aria-live="polite">
        {problem ? (
          <span className="text-red-400">{problem}</span>
        ) : ready ? (
          <span className="text-slate-200">
            {`${usersNum.toLocaleString("en-AU")} × ${formatMoney(perMemberCents!)} = `}
            <strong>{`${formatMoney(monthly)} a month`}</strong>
            {item.interval === "yearly" && (
              <>
                {" · paying yearly (12 months less 5%): "}
                <strong>{`${formatMoney(due)} a year`}</strong>
              </>
            )}
          </span>
        ) : (
          <span className="text-slate-500">{`Enter both to see what will be due (${item.interval}).`}</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Reason or note (required)"
          aria-label={`Reason for ${item.clubName}`}
          className={`${inputClass} flex-1 min-w-[14rem]`}
        />
        <button
          type="button"
          onClick={() => run("send_invoice")}
          disabled={busy !== null || !ready}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy === "send" ? "Creating invoice…" : "Send invoice"}
        </button>
        <button
          type="button"
          onClick={() => run("close")}
          disabled={busy !== null}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy === "close" ? "Closing…" : "Close request"}
        </button>
      </div>
      <p className="text-xs text-slate-500">Closing doesn&apos;t email the customer: tell them yourself if you need to.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </li>
  );
}

function InvoicedRow({ item }: { item: FullRequestItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const per = item.interval === "yearly" ? "year" : "month";

  async function cancel() {
    if (!window.confirm(`Cancel the invoice for ${item.clubName}? It is voided in Stripe, the customer is emailed to ignore it, and the request goes back to "Waiting for a price".`)) return;
    setBusy(true);
    setError("");
    const message = await send(item.id, { action: "cancel_invoice", note });
    if (message) {
      setError(message);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <li className="py-4 space-y-3">
      <Who item={item} />
      <p className="text-sm text-slate-200">
        {`${item.quotedUsers?.toLocaleString("en-AU") ?? "?"} members × ${item.perUserCents != null ? formatMoney(item.perUserCents) : "?"} = `}
        <strong>{item.periodCents != null ? `${formatMoney(item.periodCents)} a ${per}` : "?"}</strong>
        {item.invoiceDueAt && <span className="text-slate-400">{` · due ${day.format(new Date(item.invoiceDueAt))}`}</span>}
      </p>
      <p className="text-xs text-slate-400">
        {`Priced by ${item.quotedByName ?? "an admin"}${item.quotedAt ? ` on ${when.format(new Date(item.quotedAt))}` : ""}${item.quoteNote ? ` · ${item.quoteNote}` : ""}`}
        {item.invoiceUrl && (
          <>
            {" · "}
            <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Open the invoice</a>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Reason for cancelling (required)"
          aria-label={`Reason for cancelling the invoice for ${item.clubName}`}
          className={`${inputClass} flex-1 min-w-[14rem]`}
        />
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy ? "Cancelling…" : "Cancel invoice and re-price"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </li>
  );
}
