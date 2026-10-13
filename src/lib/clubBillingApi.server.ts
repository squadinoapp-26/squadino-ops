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

async function callClubApp(body: Record<string, unknown>): Promise<void> {
  const appUrl = process.env.SQUADINO_APP_URL || "https://app.squadino.com";
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) throw new Error("PROVISIONING_SECRET isn't set on the ops project, so ops can't ask the club app to change billing.");

  const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/billing/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provisioning-secret": secret },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ClubAppError(data?.error ?? `The club app refused (${res.status})`, res.status);
  }
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
