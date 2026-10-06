"use client";

import { Fragment, useState, type ReactNode } from "react";

type Item = { id: string; search: string; node: ReactNode };

// A search box above a scrolling list. Each item brings its own searchable text, so the
// same box works for any list of clubs without knowing how a row looks.
export default function SearchableList({
  items,
  placeholder,
  listClassName,
  as = "div",
  emptyText = "No matches.",
}: {
  items: Item[];
  placeholder: string;
  listClassName: string;
  as?: "div" | "ul";
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.search.toLowerCase().includes(q)) : items;
  const List = as;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full mt-4 mb-3 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      <List className={listClassName}>{shown.map((i) => <Fragment key={i.id}>{i.node}</Fragment>)}</List>
      {shown.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">{emptyText}</p>}
    </div>
  );
}
