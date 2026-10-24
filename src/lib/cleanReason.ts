export const REASON_MAX = 500;

/** A tidy optional reason, or null. */
export function cleanReason(value: unknown): string | null {
  return typeof value === "string" ? value.trim().slice(0, REASON_MAX) || null : null;
}
