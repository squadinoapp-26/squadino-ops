"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { blockedText, type Holder } from "@/lib/clubAccess";
import { useClubWatch } from "./useClubWatch";

// What a customer care officer or moderator sees instead of a club's page when someone else of those two roles has it open. Nothing about
// the club is on this screen (the server doesn't even load it), only who is in. It looks again every few seconds and offers "Open it"
// the moment the club is free; the server still decides who gets in, so two people pressing it together can't both enter.
export default function ClubBlocked({
  clubId, clubName, clubCode, holder,
}: {
  clubId: string;
  clubName: string;
  clubCode: string;
  holder: Holder;
}) {
  const router = useRouter();
  const [watch] = useClubWatch(clubId, { enabled: true, holder });
  const free = !watch.holder;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/clubs" className="text-slate-300 hover:text-white text-sm">← Back</Link>
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg">{clubName}</h1>
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{clubCode}</span>
        </div>
      </div>
      <div className="max-w-xl mx-auto p-6">
        <div className={`rounded-2xl border p-6 space-y-4 ${free ? "bg-green-900/30 border-green-700" : "bg-amber-900/30 border-amber-700"}`}>
          <h2 className="font-semibold text-lg">{free ? "This account is free now" : "Someone else has this account open"}</h2>
          <p className="text-sm text-slate-200" aria-live="polite">
            {free
              ? "The person who had it has left. You can open it now."
              : `${blockedText(watch.holder!)} Only one customer care officer or moderator can work on an account at a time, so you can't open it until they leave. An admin can always open it.`}
          </p>
          {free ? (
            <button type="button" onClick={() => router.refresh()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm pointer-coarse:min-h-11">
              Open it
            </button>
          ) : (
            <p className="text-xs text-slate-300">This page checks again every few seconds and will say when it is free.</p>
          )}
        </div>
      </div>
    </div>
  );
}
