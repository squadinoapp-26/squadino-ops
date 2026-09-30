"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Item = { href: string; label: string; desc: string };

// The "App Config" menu in the management portal header: the sports and
// restricted-words lists, Logs, Manage users and Manage accounts. Only the
// items this person can open are passed in.
export default function AppConfigMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click outside the menu or on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
        {`App Config ${open ? "▴" : "▾"}`}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-20">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-slate-700">
              <span className="block text-sm font-medium text-white">{item.label}</span>
              <span className="block text-xs text-slate-400">{item.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
