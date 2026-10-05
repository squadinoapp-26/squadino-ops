const melbourneDate = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "long" });

export interface ClubBillingInfo {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  packageKey: string | null;
  interval: string | null;
  lastEventAt: Date;
  holdEndsAt: Date | null;
  holdExtendedAt?: Date | null;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  trialing: { label: "In free trial", tone: "bg-blue-900 text-blue-300" },
  active: { label: "Active", tone: "bg-green-900 text-green-300" },
  past_due: { label: "Payment failed", tone: "bg-amber-900 text-amber-300" },
  unpaid: { label: "Unpaid", tone: "bg-red-900 text-red-300" },
  canceled: { label: "Cancelled", tone: "bg-red-900 text-red-300" },
  paused: { label: "Paused", tone: "bg-slate-700 text-slate-300" },
};

// What Stripe last told us about this club's subscription (kept up to date by the club app's
// /api/billing/sync). Shown only for clubs that have heard from Stripe.
export default function ClubBillingPanel({ billing }: { billing: ClubBillingInfo | null }) {
  if (!billing) return null;
  const status = STATUS[billing.status] ?? { label: billing.status, tone: "bg-slate-700 text-slate-300" };
  const plan = billing.packageKey
    ? `${billing.packageKey.charAt(0).toUpperCase()}${billing.packageKey.slice(1)}${billing.interval ? ` · ${billing.interval}` : ""}`
    : "—";
  const onHold = billing.packageKey === "hold";
  const holdEnds = billing.holdEndsAt ? melbourneDate.format(billing.holdEndsAt) : null;
  const periodEnd = billing.currentPeriodEnd ? melbourneDate.format(billing.currentPeriodEnd) : null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-slate-200">Billing (from Stripe)</h2>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.tone}`}>{status.label}</span>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Plan in Stripe</dt>
          <dd className="mt-0.5">{plan}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{billing.cancelAtPeriodEnd ? "Ends on" : "Current period ends"}</dt>
          <dd className="mt-0.5">{periodEnd ?? "—"}</dd>
        </div>
      </dl>
      {onHold && (
        <p className="rounded-xl bg-blue-950 text-blue-300 px-3 py-2 text-sm">
          On account hold ($50/month): Wall, Chat, Training and Stats are off and no new members can be added{holdEnds ? `. The hold ends on ${holdEnds}${billing.holdExtendedAt ? " (extended once)" : ""}; if the customer hasn't chosen by then, the subscription ends and the club is switched off` : ""}.
        </p>
      )}
      {billing.cancelAtPeriodEnd && (
        <p className="rounded-xl bg-amber-950 text-amber-300 px-3 py-2 text-sm">
          The customer has cancelled{periodEnd ? `. The club is switched off automatically on ${periodEnd}.` : "."}
        </p>
      )}
      {billing.status === "past_due" && (
        <p className="rounded-xl bg-amber-950 text-amber-300 px-3 py-2 text-sm">
          The last payment failed. Stripe is retrying and the club admins have been emailed. If it still can&apos;t be taken, the club is switched off automatically.
        </p>
      )}
      <p className="text-xs text-slate-500">{`Last update from Stripe: ${melbourneDate.format(billing.lastEventAt)}`}</p>
    </div>
  );
}
