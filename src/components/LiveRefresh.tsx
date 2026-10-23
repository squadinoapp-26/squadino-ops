"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { POLL_MS, IDLE_STOP_MS, decideRefresh, isAuthPage, isTypingTarget, shouldPoll } from "@/lib/liveRefresh";

// Keeps every ops screen up to date without anyone pressing reload. While the tab is open and someone is around, it asks
// /api/live-version every 20 seconds (and the moment they come back to the tab). When the answer changes it re-reads the page in
// place, so a new signup or a decision by another admin simply appears. If the person is typing in a box at that moment, nothing
// moves: a small "New changes" bar appears and they press it when ready. A tab nobody has touched for 15 minutes stops asking.
export default function LiveRefresh({ intervalMs = POLL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = !isAuthPage(pathname);
  // The page the "New changes" bar was raised on; it only shows there, so moving to another page clears it without any reset.
  const [waitingAt, setWaitingAt] = useState<string | null>(null);
  const pathnameRef = useRef(pathname);

  const known = useRef<string | null>(null); // the version this page was last read at
  const latest = useRef<string | null>(null); // the newest version seen, while the bar is up
  const lastActive = useRef(0); // set to "now" once the page is up (see the effect below)
  const stopped = useRef(false); // set when the server says we're signed out
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (stopped.current || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/live-version", { cache: "no-store" });
      if (res.status === 401) { stopped.current = true; return; }
      if (!res.ok) return;
      const { v } = (await res.json()) as { v?: string };
      if (typeof v !== "string") return;
      const action = decideRefresh({ known: known.current, latest: v, busy: isTypingTarget(document.activeElement as HTMLElement | null) });
      if (action === "baseline" || action === "baseline-refresh") {
        known.current = v;
        // The page was drawn a moment before this answer: read it once more so nothing that landed in between is missed.
        if (action === "baseline-refresh") router.refresh();
      } else if (action === "refresh") { known.current = v; latest.current = null; setWaitingAt(null); router.refresh(); }
      else if (action === "banner") { latest.current = v; setWaitingAt(pathnameRef.current); }
    } catch {
      // Best effort: the next check tries again.
    } finally {
      inFlight.current = false;
    }
  }, [router]);

  // Moving to another page starts fresh: whatever is shown now is current, so remember it as the starting point.
  useEffect(() => {
    pathnameRef.current = pathname;
    known.current = null;
    latest.current = null;
    stopped.current = false;
    if (!enabled) return;
    // Asked just after the page settles (not inside the effect itself), so the first answer is the starting point.
    const t = setTimeout(() => void check(), 0);
    return () => clearTimeout(t);
  }, [pathname, enabled, check]);

  useEffect(() => {
    if (!enabled) return;
    lastActive.current = Date.now();
    const id = setInterval(() => {
      if (shouldPoll({ visible: document.visibilityState === "visible", idleMs: Date.now() - lastActive.current })) void check();
    }, intervalMs);

    // Any sign of life counts. Coming back after a long quiet spell (or to a hidden tab) checks straight away.
    const touch = () => {
      const wasIdle = Date.now() - lastActive.current >= IDLE_STOP_MS;
      lastActive.current = Date.now();
      if (wasIdle) void check();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      lastActive.current = Date.now();
      void check();
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, check]);

  if (!enabled || waitingAt !== pathname) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-md">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-700 bg-blue-950 px-4 py-3 text-sm text-white shadow-xl">
        <span>New changes have come in.</span>
        <button
          type="button"
          onClick={() => {
            known.current = latest.current ?? known.current;
            latest.current = null;
            setWaitingAt(null);
            router.refresh();
          }}
          className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold pointer-coarse:min-h-11"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
