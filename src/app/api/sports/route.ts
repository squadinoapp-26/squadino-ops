import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanSportName } from "@/lib/sportCatalog";
import { listSports } from "@/lib/sportCatalog.server";
import { getPlatformUser, canManageSportsList } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

// Adds a sport to the platform-wide list every sport picker offers.
export async function POST(req: NextRequest) {
  const actor = await getPlatformUser();
  if (!canManageSportsList(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can change the sports list." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const cleaned = cleanSportName(body?.name);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim().slice(0, 16) : undefined;

  // Make sure the defaults are in before the first custom sport, so adding
  // one to a fresh table doesn't leave pickers with only that sport.
  await listSports();

  const existing = await prisma.sport.findFirst({
    where: { name: { equals: cleaned.name, mode: "insensitive" } },
    select: { name: true },
  });
  if (existing) return NextResponse.json({ error: `"${existing.name}" is already on the list.` }, { status: 409 });

  const sport = await prisma.sport.create({ data: { name: cleaned.name, ...(icon && { icon }) } });
  await recordAudit(actor, { action: "sport.add", targetType: "sport", targetId: sport.id, targetLabel: sport.name });
  return NextResponse.json({ sport }, { status: 201 });
}
