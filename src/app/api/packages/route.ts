import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManagePackages } from "@/lib/auth";

function slugKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "package";
}

// POST /api/packages → create a new package. Super admin only: the numbers
// (user cap, price) and the trial length are entirely admin-defined.
export async function POST(req: NextRequest) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canManagePackages(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, userCap, priceCents, trialDays, sortOrder } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (userCap !== null && (typeof userCap !== "number" || userCap < 1)) {
    return NextResponse.json({ error: "User cap must be a positive number, or blank for unlimited" }, { status: 400 });
  }
  if (typeof priceCents !== "number" || priceCents < 0) {
    return NextResponse.json({ error: "Price must be zero or more" }, { status: 400 });
  }
  if (trialDays !== null && (typeof trialDays !== "number" || trialDays < 0)) {
    return NextResponse.json({ error: "Trial days must be zero or more, or blank for no trial" }, { status: 400 });
  }

  const wantKey = slugKey(name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const key = attempt === 0 ? wantKey : `${wantKey}_${attempt}`;
    try {
      const pkg = await prisma.package.create({
        data: { key, name: name.trim(), userCap, priceCents, trialDays, sortOrder: sortOrder ?? 0 },
      });
      return NextResponse.json(pkg, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Unique constraint")) continue;
      return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not generate a unique package key, try a different name" }, { status: 409 });
}
