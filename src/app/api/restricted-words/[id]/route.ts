import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canManageRestrictedWords } from "@/lib/auth";
import { recordAudit } from "@/lib/auditLog.server";

// Takes a word off the restricted-words list every club gets. A club that
// added the same word to its own list keeps it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getPlatformUser();
  if (!canManageRestrictedWords(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can change the restricted-words list." }, { status: 403 });
  }
  const { id } = await params;
  const row = await prisma.platformBannedWord.findUnique({ where: { id }, select: { word: true } });
  if (!row) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  await prisma.platformBannedWord.delete({ where: { id } });
  await recordAudit(actor, { action: "word.remove", targetType: "word", targetId: id, targetLabel: row.word });
  return NextResponse.json({ ok: true });
}
