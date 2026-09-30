import Link from "next/link";
import { listPlatformWords } from "@/lib/restrictedWordsList";
import { getPlatformUser, canManageRestrictedWords } from "@/lib/auth";
import RestrictedWordsManager from "./RestrictedWordsManager";

export const dynamic = "force-dynamic";

export default async function PlatformRestrictedWordsPage() {
  const [words, viewer] = await Promise.all([listPlatformWords(), getPlatformUser()]);
  // An empty id means the table couldn't be read and the built-in list is
  // showing (the database update hasn't run yet) — shown read-only.
  const fromDatabase = words.length === 0 || words[0].id !== "";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Restricted words</h1>
      </div>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <p className="text-sm text-slate-400">
          The words and phrases every club blocks, on top of the ones each club adds for itself. Chat messages that
          contain one are blocked; wall posts and comments are held for the club&apos;s moderators to review. Words
          match whole words only, ignoring capitals. Changes apply to every club straight away.
        </p>
        {!fromDatabase && (
          <p className="rounded-xl bg-amber-950 text-amber-300 px-4 py-3 text-sm">
            This is the built-in list — the database update (<span className="font-mono">db-sync.cmd</span>) hasn&apos;t
            added the table yet, so it can&apos;t be edited until then.
          </p>
        )}
        <RestrictedWordsManager words={words} canManage={fromDatabase && canManageRestrictedWords(viewer?.role)} />
      </div>
    </div>
  );
}
