// The people who can sign in to the management portal (Manage users,
// /staff): what a valid new account looks like, and the safety
// rules for changing one. Pure, so it's unit-tested and shared by the page
// and the API routes.
import { passwordProblem } from "@/lib/passwordPolicy";

export const PLATFORM_ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER_CARE"] as const;
export type PlatformRoleName = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleName, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  CUSTOMER_CARE: "Customer care",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlatformRole(value: unknown): value is PlatformRoleName {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/** Checks the "Add a person" form and returns the tidied values. */
export function parseNewStaff(body: unknown):
  | { ok: true; data: { name: string; email: string; role: PlatformRoleName; password: string } }
  | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (!name) return { ok: false, error: "Enter their name." };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!isPlatformRole(b.role)) return { ok: false, error: "Pick a role." };
  const problem = passwordProblem(b.password);
  if (problem) return { ok: false, error: problem };
  return { ok: true, data: { name, email, role: b.role, password: b.password as string } };
}

/**
 * Why a change to a portal account isn't allowed, or null if it is. Nobody
 * can demote or switch off themselves (so they can't lock themselves out by
 * mistake), and there must always be at least one active super admin.
 */
export function staffChangeProblem(opts: {
  actorId: string;
  target: { id: string; role: PlatformRoleName; active: boolean };
  next: { role: PlatformRoleName; active: boolean };
  activeSuperAdmins: number;
}): string | null {
  const { actorId, target, next, activeSuperAdmins } = opts;
  const isSelf = actorId === target.id;
  if (isSelf && !next.active) return "You can't switch off your own account.";
  if (isSelf && next.role !== target.role) return "You can't change your own role — ask another super admin.";
  const losesSuperAdmin = target.role === "SUPER_ADMIN" && target.active && (next.role !== "SUPER_ADMIN" || !next.active);
  if (losesSuperAdmin && activeSuperAdmins <= 1) return "There must always be at least one active super admin.";
  return null;
}
