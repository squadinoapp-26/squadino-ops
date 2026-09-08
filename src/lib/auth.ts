import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "squadino_ops_session";
const SESSION_TTL_HOURS = 12;

// PlatformSession.token stores a hash, never the raw bearer value — same
// reasoning as squadino's own Session/PlatformSession handling (they share
// this table): a database-only compromise must not hand over ready-to-use
// session tokens. The raw token lives only in the browser's cookie.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface PlatformSessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export async function createPlatformSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.platformSession.create({ data: { token: hashToken(token), platformUserId: userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPlatformSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.platformSession.deleteMany({ where: { token: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getPlatformSession(): Promise<PlatformSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.platformSession.findUnique({
    where: { token: hashToken(token) },
    include: { platformUser: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.platformUser.active) return null;
  return session.platformUser;
}

// For API routes: throws so the caller can turn it into a 401/403 JSON
// response (they already wrap this in .catch()). Never call this directly
// from a page — an uncaught throw during render surfaces as a raw runtime
// error page instead of sending the visitor to sign in (e.g. after a
// password reset invalidates their session mid-visit).
export async function requirePlatformSession() {
  const user = await getPlatformSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// For page Server Components: redirects to /login instead of throwing, so a
// missing/expired/invalidated session sends the visitor to sign back in
// rather than crashing the render.
export async function requirePlatformSessionOrRedirect() {
  const user = await getPlatformSession();
  if (!user) redirect("/login");
  return user;
}

// SUPER_ADMIN: everything, incl. package pricing and other staff.
// ADMIN: manage clients, support-login, resolve alerts.
// MODERATOR: content oversight only.
// CUSTOMER_CARE: read-only + notifications.
export function canManageClients(role: string) {
  return ["SUPER_ADMIN", "ADMIN"].includes(role);
}

export function canManagePackages(role: string) {
  return role === "SUPER_ADMIN";
}

export function canManageStaff(role: string) {
  return role === "SUPER_ADMIN";
}

export function canManageSettings(role: string) {
  return role === "SUPER_ADMIN";
}

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  CUSTOMER_CARE: "Customer Care",
};
