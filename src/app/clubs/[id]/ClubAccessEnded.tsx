"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removedText } from "@/lib/clubAccess";

// What a customer care officer or moderator sees when an admin took a club over from them a little while ago and they try to open it
// again (including when their own screen refreshes itself). Nothing about the club is on this screen. "Check again" asks the server,
// which lets them in once the keep-out time has run down.
export default function ClubAccessEnded({
  clubName, clubCode, by, minutesLeft,
}: {
  clubName: string;
  clubCode: string;
  by: string;
  minutesLeft: number;
}) {
  const router = useRouter();
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
        <div className="rounded-2xl border bg-amber-900/30 border-amber-700 p-6 space-y-4">
          <h2 className="font-semibold text-lg">An admin ended your access to this account</h2>
          <p className="text-sm text-slate-200">{removedText(by, minutesLeft)}</p>
          <button type="button" onClick={() => router.refresh()}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg text-sm pointer-coarse:min-h-11">
            Check again
          </button>
        </div>
      </div>
    </div>
  );
}
