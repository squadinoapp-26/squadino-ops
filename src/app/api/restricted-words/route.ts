import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canManageRestrictedWords } from "@/lib/auth";
import { cleanRestrictedWord } from "@/lib/restrictedWords";
import { listPlatformWords } from "@/lib/restrictedWordsList";
import { recordAudit } from "@/lib/auditLog.server";

// Adds a word or phrase to the restricted-words list every club gets.
export async function POST(req: NextRequest) {
  const actor = await getPlatformUser();
  if (!canManageRestrictedWords(actor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can change the restricted-words list." }, { status: 403 });
  }

  const cleaned = cleanRestrictedWord((await req.json().catch(() => ({})))?.word);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  // Make sure the starting list is in first, so adding one word to a fresh
  // table doesn't leave clubs with only that word.
  await listPlatformWords();

  if (await prisma.platformBannedWord.findUnique({ where: { word: cleaned.word }, select: { id: true } })) {
    return NextResponse.json({ error: `"${cleaned.word}" is already on the list.` }, { status: 409 });
  }
  const row = await prisma.platformBannedWord.create({ data: { word: cleaned.word, addedBy: actor!.name } });
  await recordAudit(actor, { action: "word.add", targetType: "word", targetId: row.id, targetLabel: row.word });
  return NextResponse.json({ word: { id: row.id, word: row.word } }, { status: 201 });
}
