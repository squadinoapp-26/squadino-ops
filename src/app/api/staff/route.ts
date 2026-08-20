import { NextRequest, NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import { PlatformRole } from "@/generated/prisma/enums";

const HASH_OPTS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };
const VALID_ROLES = Object.values(PlatformRole);

export async function POST(req: NextRequest) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManageStaff(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, password, role } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (typeof email !== "string" || !email.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  try {
    const user = await prisma.platformUser.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash: await hash(password, HASH_OPTS), role: role as PlatformRole },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Unique constraint")) return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create staff account" }, { status: 500 });
  }
}
