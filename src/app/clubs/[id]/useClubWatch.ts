"use client";
import { useEffect, useState } from "react";
import { WATCH_MS, type Holder } from "@/lib/clubAccess";

export interface ClubWatch {
  /** False until the database update that adds the account-lock table has been run. */
  enabled: boolean;
  /** The customer care officer or moderator who has the club open right now, if any. */
  holder: Holder | null;
}

// Looks again at who has a club's account open every few seconds while the tab is showing (and the moment it comes back into view).
// Used by the waiting screen (to say "it's free now") and by an admin's panel (to show who is in).
export function useClubWatch(clubId: string, initial: ClubWatch) {
  const [watch, setWatch] = useState<ClubWatch>(initial);

  useEffect(() => {
    let stopped = false;
    async function look() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/clubs/${clubId}/access`, { cache: "no-store" });
        if (res.status === 401 || res.status === 403) { stopped = true; return; } // signed out: the sign-in page takes over
        if (!res.ok) return;
        const j = (await res.json()) as ClubWatch;
        if (!stopped) setWatch({ enabled: j.enabled, holder: j.holder });
      } catch {
        // Best effort: the next look tries again.
      }
    }
    const timer = setInterval(() => void look(), WATCH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void look(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clubId]);

  return [watch, setWatch] as const;
}
