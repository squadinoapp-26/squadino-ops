import { prisma } from "@/lib/prisma";

// The delivery/pickup options every new club starts with, so a club's merch
// store works out of the box without a club admin setting delivery up first.
// MIRRORS the club app's DEFAULT_DELIVERY_OPTIONS in its src/lib/merch.ts —
// keep the two in sync (same as the schema mirror). The club can edit, hide,
// reorder or delete these afterwards like any other option. `sortOrder` keeps
// them in this order at checkout; the addresses are starter text to edit.
export const DEFAULT_DELIVERY_OPTIONS = [
  { type: "PICKUP", label: "Pick up at training", address: "At the next training session", fee: 0, estimate: null as string | null, sortOrder: 0 },
  { type: "COORDINATOR", label: "Pickup from someone", address: "Arrange a time with the club", fee: 0, estimate: null as string | null, sortOrder: 1 },
  { type: "SHIP", label: "Posted", address: null as string | null, fee: 0, estimate: "Allow 3–5 business days", sortOrder: 2 },
] as const;

// Seed a brand-new club with the starter delivery options. Best-effort: a
// failure (e.g. the table isn't there yet on an older database) must never stop
// a club being created, so it's swallowed — an admin can still add options by
// hand in the club app.
export async function seedDefaultDeliveryOptions(clubId: string) {
  try {
    await prisma.merchDeliveryOption.createMany({
      data: DEFAULT_DELIVERY_OPTIONS.map((o) => ({ ...o, clubId })),
    });
  } catch {
    /* table missing or write failed — the club is still fine without them */
  }
}
