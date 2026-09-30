import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Sends someone without a working session to the sign-in page (or a 401 for API calls), and
// drops the bad cookie so a stale or forged value doesn't linger.
function deny(request: NextRequest): NextResponse {
  const res = request.nextUrl.pathname.startsWith("/api")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$/.test(pathname)) return NextResponse.next();

  // The cookie must be a real, unexpired session of an active staff member, looked up in the
  // database, so a made-up cookie value is turned away here instead of reaching any page.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return deny(request);
  const session = await prisma.platformSession.findUnique({
    where: { token: hashToken(token) },
    select: { expiresAt: true, platformUser: { select: { active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.platformUser.active) return deny(request);

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
