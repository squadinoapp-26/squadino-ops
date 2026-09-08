// Rules for choosing a new password. Shared by the reset flow and the
// admin reset-password form so both accept exactly the same thing.

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Returns a message describing what's wrong with a password, or null if it's
 * acceptable. Length is the main lever — long passphrases beat short complex
 * ones — so the rules stay deliberately light beyond a sensible minimum.
 */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "Enter a new password";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) return "That password is too long";
  if (!password.trim()) return "Password can't be only spaces";
  return null;
}
