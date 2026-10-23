"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HEARTBEAT_MS, IDLE_LIMIT_MS, endReasonText, type EndReason } from "@/lib/clubAccess";

// Sits on a club's page while a customer care officer or moderator has it open (one at a time, see clubAccess.ts). It tells the server
// "still here" every 30 seconds, and whether the person has touched the page since; says "I've left" when the page closes; and, if the
// server says the hold has ended (an admin took over, they were away too long), covers the page with a message so nothing can be done
// from a screen that is no longer theirs. The server refuses their changes anyway (423): this is only the kind way of telling them.
export default function ClubAccessKeeper({ clubId, viewId }: { clubId: string; viewId: string }) {
  const [ended, setEnded] = useState<EndReason | null>(null);
  const endedRef = useRef(false);
  const touched = useRef(true); // opening the page counts as activity
  const viewRef = useRef(viewId); // the page's marker changes each time the server draws it; the latest one is the one to release
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    viewRef.current = viewId;
  }, [viewId]);

  useEffect(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = undefined;
    }
    const touch = () => { touched.current = true; };
    const touchEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
    for (const name of touchEvents) window.addEventListener(name, touch, { passive: true });

    async function beat() {
      if (endedRef.current) return;
      const wasActive = touched.current;
      touched.current = false;
      try {
        const res = await fetch(`/api/clubs/${clubId}/access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: wasActive }),
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) return; // signed out: the sign-in page takes over
        const out = (await res.json()) as { ok: boolean; reason?: EndReason };
        if (!out.ok && out.reason) {
          endedRef.current = true;
          setEnded(out.reason);
        }
      } catch {
        // The report didn't arrive: say it again at the next one.
        touched.current = touched.current || wasActive;
      }
    }

    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);

    const releaseUrl = () => `/api/clubs/${clubId}/access/release?v=${encodeURIComponent(viewRef.current)}`;
    // Closing or leaving the page: a beacon is the one request a closing page can still send.
    const onHide = () => { if (!endedRef.current) navigator.sendBeacon(releaseUrl()); };
    // Coming back from the browser's back/forward cache shows an old page whose hold was released: draw it again.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) location.reload(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);

    return () => {
      clearInterval(timer);
      for (const name of touchEvents) window.removeEventListener(name, touch);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      // Moving to another page of the console frees the club too. A moment's delay, so a re-mount (development mode does one)
      // cancels it instead of freeing the hold.
      leaveTimer.current = setTimeout(() => {
        if (!endedRef.current) void fetch(releaseUrl(), { method: "POST", keepalive: true }).catch(() => {});
      }, 150);
    };
  }, [clubId]);

  return (
    <>
      <p className="text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
        You have this account open. Other customer care officers and moderators can&apos;t open it until you leave this page or have been
        away for {IDLE_LIMIT_MS / 60_000} minutes.
      </p>
      {ended && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="access-ended-title"
          className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 id="access-ended-title" className="font-semibold text-lg">This account is no longer open for you</h2>
            <p className="text-sm text-slate-300">{endReasonText(ended)}</p>
            <p className="text-sm text-slate-300">Nothing you typed on this page has been saved.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => location.reload()}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm pointer-coarse:min-h-11">
                Try to open it again
              </button>
              <Link href="/clubs" className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm pointer-coarse:min-h-11 inline-flex items-center">
                Back to accounts
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
