// The customer's say in an account hold. A hold is never started or ended for them: the club's
// admins are emailed an offer with a private link, and nothing changes until they answer it.
// Pure, so the rules are unit-tested without a database.

// START: "would you like to put your club on hold?"  END: "your hold is ending: what next?"
export type OfferKind = "START" | "END";
export type OfferChoice = "accept" | "decline" | "continue" | "end";

export const OFFER_VALID_DAYS = 14;

export const OFFER_CHOICES: Record<OfferKind, OfferChoice[]> = {
  START: ["accept", "decline"],
  END: ["continue", "end"],
};

export function isValidChoice(kind: OfferKind, choice: unknown): choice is OfferChoice {
  return typeof choice === "string" && (OFFER_CHOICES[kind] as string[]).includes(choice);
}

export function isOfferKind(value: unknown): value is OfferKind {
  return value === "START" || value === "END";
}

/** When an offer sent at `now` stops working. */
export function offerExpiry(now: Date): Date {
  return new Date(now.getTime() + OFFER_VALID_DAYS * 24 * 60 * 60 * 1000);
}

export type OfferState = "open" | "used" | "expired" | "cancelled";

/** Whether a link can still be answered, from what is stored and the time. */
export function offerState(offer: { status: string; expiresAt: Date }, now: Date): OfferState {
  if (offer.status === "CANCELLED") return "cancelled";
  if (offer.status !== "PENDING") return "used";
  return offer.expiresAt <= now ? "expired" : "open";
}

/** Short words for an offer's progress, for staff in the ops app. */
export function offerStatusLabel(offer: { status: string; choice: string | null; expiresAt: Date }, now: Date): string {
  const state = offerState(offer, now);
  if (state === "open") return "Waiting for the customer";
  if (state === "expired") return "Expired without an answer";
  if (state === "cancelled") return "Replaced by a newer offer";
  if (offer.choice === "accept") return "Customer accepted: on hold";
  if (offer.choice === "decline") return "Customer declined";
  if (offer.choice === "continue") return "Customer chose to continue on their plan";
  if (offer.choice === "end") return "Customer chose to end the subscription";
  return "Answered";
}
