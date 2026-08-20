import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "squadino_ops_session";
const SESSION_TTL_HOURS = 12;

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
  await prisma.platformSession.create({ data: { token, platformUserId: userId, expiresAt } });
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
  if (token) await prisma.platformSession.deleteMany({ where: { token } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getPlatformSession(): Promise<PlatformSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.platformSession.findUnique({
    where: { token },
    include: { platformUser: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.platformUser.active) return null;
  return session.platformUser;
}

export async function requirePlatformSession() {
  const user = await getPlatformSession();
  if (!user) throw new Error("Unauthorized");
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
