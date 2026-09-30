import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canManageSportsList } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

// Removes a sport from the list pickers offer. Clubs store sport names, not
// references, so any club already running it keeps it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getPlatformUser();
  if (!canManageSportsList(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can change the sports list." }, { status: 403 });
  }
  const { id } = await params;
  const sport = await prisma.sport.findUnique({ where: { id }, select: { name: true } });
  const deleted = await prisma.sport.deleteMany({ where: { id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Sport not found" }, { status: 404 });
  await recordAudit(actor, { action: "sport.remove", targetType: "sport", targetId: id, targetLabel: sport?.name ?? id });
  return NextResponse.json({ ok: true });
}
