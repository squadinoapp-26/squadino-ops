import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { createPlatformSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.platformUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  await createPlatformSession(user.id);
  return NextResponse.json({ ok: true });
}
