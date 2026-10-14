// Account hold, resume and cancel are done in Stripe by the club app, which already holds the
// Stripe key and the rules for what each does to the club. Ops only asks, with the same shared
// secret the website uses for provisioning.
export class ClubAppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function callClubApp(body: Record<string, unknown>, path = "/api/billing/actions"): Promise<Record<string, unknown>> {
  const appUrl = process.env.SQUADINO_APP_URL || "https://app.squadino.com";
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) throw new Error("PROVISIONING_SECRET isn't set on the ops project, so ops can't ask the club app to change billing.");

  const res = await fetch(`${appUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provisioning-secret": secret },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClubAppError(data?.error ?? `The club app refused (${res.status})`, res.status);
  return data;
}

// The Full package (more than 1,000 members, priced per member): the club app owns the Stripe key, so it creates
// and sends the invoice, cancels it, or closes the request. Ops decides who may ask and writes the Logs entry.
export async function runFullPackageAction(
  requestId: string,
  action: "send_invoice" | "cancel_invoice" | "close",
  by: { name: string; role: string },
  note: string,
  quote?: { users: number; perMemberCents: number },
): Promise<{ periodCents?: number; invoiceUrl?: string | null }> {
  const data = await callClubApp(
    { action, requestId, decidedByName: by.name, decidedByRole: by.role, note, users: quote?.users, perMemberCents: quote?.perMemberCents },
    "/api/billing/full",
  );
  return { periodCents: typeof data.periodCents === "number" ? data.periodCents : undefined, invoiceUrl: typeof data.invoiceUrl === "string" ? data.invoiceUrl : null };
}

export async function runClubBillingAction(
  clubId: string,
  action: "offer_hold" | "offer_extension" | "resume" | "cancel",
  requestedBy?: string,
  opts: { months?: number } = {},
): Promise<void> {
  await callClubApp({ clubId, action, requestedBy, months: opts.months });
}

// A club's request for extra members: approving adds them to its Stripe subscription (the club app does that
// and marks the request approved); declining only records the decision and emails the club's admin.
export async function decideExtraMembersInClubApp(
  clubId: string,
  requestId: string,
  decision: "approve" | "decline",
  by: { name: string; role: string },
  note: string | null,
): Promise<void> {
  await callClubApp({
    clubId,
    requestId,
    action: decision === "approve" ? "approve_extra_members" : "decline_extra_members",
    decidedByName: by.name,
    decidedByRole: by.role,
    note,
  });
}
