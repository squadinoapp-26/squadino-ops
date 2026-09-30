// Payment ids the marketing site's dummy (test-mode) checkout hands out. Nothing was charged.
export function isDummyPaymentId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("dummy_");
}
