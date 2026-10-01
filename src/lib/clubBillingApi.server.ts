// Account hold, resume and cancel are done in Stripe by the club app, which already holds the
// Stripe key and the rules for what each does to the club. Ops only asks, with the same shared
// secret the website uses for provisioning.
export async function runClubBillingAction(clubId: string, action: "start_hold" | "resume" | "cancel"): Promise<void> {
  const appUrl = process.env.SQUADINO_APP_URL || "https://app.squadino.com";
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) throw new Error("PROVISIONING_SECRET isn't set on the ops project, so ops can't ask the club app to change billing.");

  const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/billing/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provisioning-secret": secret },
    body: JSON.stringify({ clubId, action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `The club app refused (${res.status})`);
  }
}
