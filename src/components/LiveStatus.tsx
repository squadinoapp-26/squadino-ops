"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import type { LiveStatus } from "@/lib/presence";

const POLL_MS = 15000;

const LiveStatusContext = createContext<LiveStatus | null>(null);

// Renders the initial (server-fetched) snapshot immediately, then polls
// /api/live-status every 15s to keep the numbers current — no page reload.
export function LiveStatusProvider({ initial, children }: { initial: LiveStatus; children: React.ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>(initial);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/live-status");
        if (res.ok) setStatus(await res.json());
      } catch {
        // best-effort — keep showing the last known status until the next tick
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return <LiveStatusContext.Provider value={status}>{children}</LiveStatusContext.Provider>;
}

function useLiveStatus(): LiveStatus {
  const ctx = useContext(LiveStatusContext);
  if (!ctx) throw new Error("useLiveStatus must be used within LiveStatusProvider");
  return ctx;
}

export function OnlineNowValue() {
  const { totalOnline } = useLiveStatus();
  return <>{totalOnline}</>;
}

export function BusiestClients() {
  const { busiest } = useLiveStatus();
  if (busiest.length === 0) {
    return <p className="text-sm text-slate-500">No one&apos;s online right now.</p>;
  }
  return (
    <div className="space-y-2">
      {busiest.map((c, i) => (
        <Link key={c.clubId} href={`/clubs/${c.clubId}`}
          className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm font-mono w-4">{i + 1}</span>
            <span className="font-medium">{c.name}</span>
          </div>
          <span className="flex items-center gap-1.5 text-sm text-green-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-400" /> {c.online} online
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ClubOnlineBadge({ clubId }: { clubId: string }) {
  const { perClub } = useLiveStatus();
  const online = perClub[clubId] ?? 0;
  if (online === 0) {
    return (
      <span className="text-xs text-slate-500 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Offline
      </span>
    );
  }
  return (
    <span className="text-xs text-green-400 font-medium flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {online} online
    </span>
  );
}
