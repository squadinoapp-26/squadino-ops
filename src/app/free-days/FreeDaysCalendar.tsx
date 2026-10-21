"use client";
import { useRef, useState } from "react";
import { datesBetween, longDayName, monthGrid, monthTitle, shiftMonth, toggled, withRange } from "@/lib/freeDaysCalendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A month calendar where each day is a button that switches it on or off. Click a day to pick it; Shift + click picks every day
// from the last one you clicked. The "From / To" boxes below do the same for a run of days on a phone or with the keyboard.
export default function FreeDaysCalendar({
  selected, onChange, todayIso, minIso, maxIso,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
  todayIso: string;
  minIso: string;
  maxIso: string;
}) {
  const [view, setView] = useState(() => ({ year: Number(todayIso.slice(0, 4)), monthIndex: Number(todayIso.slice(5, 7)) - 1 }));
  const anchor = useRef<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangeError, setRangeError] = useState("");
  const chosen = new Set(selected);
  const weeks = monthGrid(view.year, view.monthIndex);

  function pick(iso: string, shift: boolean) {
    if (shift && anchor.current) onChange(withRange(selected, anchor.current, iso).filter((d) => d >= minIso && d <= maxIso));
    else onChange(toggled(selected, iso));
    anchor.current = iso;
  }

  function addRange() {
    setRangeError("");
    if (!from || !to) return setRangeError("Choose both dates.");
    const days = datesBetween(from, to);
    if (days.some((d) => d < minIso || d > maxIso)) return setRangeError("Some of those days are too far from today.");
    onChange([...new Set([...selected, ...days])].sort());
    setFrom("");
    setTo("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v.year, v.monthIndex, -1))}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">‹</button>
        <p className="font-semibold" aria-live="polite">{monthTitle(view.year, view.monthIndex)}</p>
        <button type="button" aria-label="Next month" onClick={() => setView((v) => shiftMonth(v.year, v.monthIndex, 1))}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1" aria-hidden="true">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map(({ iso, inMonth }) => {
          const on = chosen.has(iso);
          const out = iso < minIso || iso > maxIso;
          return (
            <button key={iso} type="button" disabled={out} aria-pressed={on}
              aria-label={`${longDayName(iso)}${iso === todayIso ? ", today" : ""}${on ? ", free day" : ""}`}
              onClick={(e) => pick(iso, e.shiftKey)}
              className={`h-10 rounded-lg text-sm transition-colors ${
                on ? "bg-blue-600 text-white font-semibold hover:bg-blue-500"
                : out ? "text-slate-600 cursor-not-allowed"
                : inMonth ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              } ${iso === todayIso ? "ring-2 ring-amber-400" : ""}`}>
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-2">Click a day to pick it, and click it again to take it off. To pick a run of days, click the first day, then hold Shift and click the last.</p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="range-from" className="block text-xs text-slate-400 mb-1">From</label>
          <input id="range-from" type="date" value={from} min={minIso} max={maxIso} onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="range-to" className="block text-xs text-slate-400 mb-1">To</label>
          <input id="range-to" type="date" value={to} min={minIso} max={maxIso} onChange={(e) => setTo(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <button type="button" onClick={addRange} className="bg-slate-700 hover:bg-slate-600 text-sm font-semibold px-3 py-1.5 rounded-lg">Add these days</button>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-sm text-slate-300 hover:text-white underline px-2 py-1.5">Clear all days</button>
        )}
      </div>
      {rangeError && <p className="text-sm text-red-400 mt-2">{rangeError}</p>}
    </div>
  );
}
