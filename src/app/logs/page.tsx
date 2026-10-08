import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canViewLogs } from "@/lib/auth";
import { listAuditLogs, LOGS_PAGE_SIZE, type AuditLogRow } from "@/lib/auditLog.server";
import { auditActionLabel, formatAuditValue, isAuditAction, parseDateInput, taskOptions } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

// Stamps are shown in Melbourne time whatever timezone the server runs in.
const when = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  dateStyle: "medium",
  timeStyle: "medium",
});

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  CUSTOMER_CARE: "Customer care",
};

// The platform Logs: every change made in this console, newest first.
// Read-only by design — this page only reads, and there's no route anywhere
// that edits or deletes an entry.
export default async function PlatformLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; item?: string; q?: string; task?: string; from?: string; to?: string }>;
}) {
  const viewer = await getPlatformUser();
  if (!canViewLogs(viewer?.role)) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">Only platform super admins and admins can view the Logs.</p>
      </Shell>
    );
  }

  const { page: pageParam, item, q: qParam, task: taskParam, from: fromParam, to: toParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const q = (qParam ?? "").trim().slice(0, 200);
  // Only values the page understands are kept, so a hand-edited address can't do anything odd.
  const task = isAuditAction(taskParam) ? taskParam : "";
  const from = parseDateInput(fromParam) ? fromParam! : "";
  const to = parseDateInput(toParam) ? toParam! : "";
  const filtered = !!(q || task || from || to);
  const { rows, total, missingTable } = await listAuditLogs({ page, targetId: item, query: q, task, from, to });
  const pages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));
  const live = await existingTargets(rows);

  const keep = { ...(item && { item }), ...(q && { q }), ...(task && { task }), ...(from && { from }), ...(to && { to }) };
  const pageHref = (p: number) => `/logs?${new URLSearchParams({ ...keep, page: String(p) })}`;
  const clearHref = item ? `/logs?item=${encodeURIComponent(item)}` : "/logs";
  const describeFilters = [
    q && `“${q}”`,
    task && auditActionLabel(task),
    (from || to) && (from && to ? (from === to ? `on ${from}` : `from ${from} to ${to}`) : from ? `from ${from}` : `up to ${to}`),
  ].filter(Boolean).join(" · ");

  return (
    <Shell>
      <p className="text-sm text-slate-400">
        Every change made in this console: who made it, when (Melbourne time) and what it was before and after.
        Entries can&apos;t be edited or deleted.
      </p>

      <form action="/logs" method="get" className="space-y-3 bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
        {item && <input type="hidden" name="item" value={item} />}
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder="Search by club name, staff name, username, email, web address, date or reason…"
            aria-label="Search the Logs"
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 focus:border-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Search
          </button>
          {filtered && (
            <Link href={clearHref}
              className="bg-slate-700 hover:bg-slate-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              Clear
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400 space-y-1">
            <span className="block">Task</span>
            <select name="task" defaultValue={task} aria-label="Task"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 max-w-xs">
              <option value="">Any task</option>
              {taskOptions().map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.tasks.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400 space-y-1">
            <span className="block">From date</span>
            <input type="date" name="from" defaultValue={from} aria-label="From date"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 [color-scheme:dark]" />
          </label>
          <label className="text-xs text-slate-400 space-y-1">
            <span className="block">To date</span>
            <input type="date" name="to" defaultValue={to} aria-label="To date"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 [color-scheme:dark]" />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          The search finds clubs and signups (by name, web address or contact), staff (by name or email), a club&apos;s owner (by name,
          username or email), the reasons and notes, what was changed, the kind of task (&quot;setup email&quot;, &quot;subdomain&quot;,
          &quot;hold&quot;…) and a date typed as 9/10/2026. Every word you type has to match. Dates are Melbourne days.
        </p>
      </form>

      {filtered && !missingTable && (
        <p className="text-sm text-slate-300">
          {total === 0 ? "No entries match" : `${total} ${total === 1 ? "entry matches" : "entries match"}`} <strong>{describeFilters}</strong>.
        </p>
      )}

      {missingTable && (
        <p className="rounded-xl bg-amber-950 text-amber-300 px-4 py-3 text-sm">
          The Logs table hasn&apos;t been added to this database yet, so nothing is being recorded. Run the database
          update (<span className="font-mono">db-sync.cmd</span>) once and changes will start appearing here.
        </p>
      )}

      {item && (
        <p className="text-sm text-slate-300">
          Showing the history of {rows[0] ? <strong>{rows[0].targetLabel}</strong> : "one item"}.{" "}
          <Link href="/logs" className="text-blue-400 hover:underline">Show everything</Link>
        </p>
      )}

      {!missingTable && rows.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="font-medium">{filtered ? "Nothing found. Try fewer words, another task or a wider date range." : "No changes recorded yet."}</p>
        </div>
      )}

      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm">
                <span className="font-semibold">{auditActionLabel(row.action)}</span>
                {" · "}
                <TargetName row={row} live={live} />
              </p>
              <p className="text-xs text-slate-500 whitespace-nowrap">{when.format(row.createdAt)}</p>
            </div>
            <p className="text-xs text-slate-400">
              {`By ${row.actorName} (${ROLE_LABELS[row.actorRole] ?? row.actorRole})`}
            </p>
            {row.changes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="font-normal pb-1 pr-4">Field</th>
                      <th className="font-normal pb-1 pr-4">Before</th>
                      <th className="font-normal pb-1">After</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {row.changes.map((c) => (
                      <tr key={c.field} className="border-t border-slate-700/60">
                        <td className="py-1.5 pr-4 text-slate-400 whitespace-nowrap">{c.label}</td>
                        <td className="py-1.5 pr-4 text-red-300 break-words">{formatAuditValue(c.from)}</td>
                        <td className="py-1.5 text-green-300 break-words">{formatAuditValue(c.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {row.note && <p className="text-sm text-slate-300">{row.note}</p>}
          </li>
        ))}
      </ol>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-blue-400 hover:underline">← Newer</Link> : <span />}
          <span className="text-slate-500">{`Page ${page} of ${pages}`}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="text-blue-400 hover:underline">Older →</Link> : <span />}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Logs</h1>
      </div>
      <div className="max-w-4xl mx-auto p-6 space-y-5">{children}</div>
    </div>
  );
}

// Which signups and clubs in this page of entries still exist, so only those
// are linked (a deleted club's entries stay, but there's no page to open).
async function existingTargets(rows: AuditLogRow[]): Promise<Set<string>> {
  const ids = (type: string) => [...new Set(rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId!))];
  const [signups, clubs] = await Promise.all([
    prisma.signupRequest.findMany({ where: { id: { in: ids("signup") } }, select: { id: true } }),
    prisma.club.findMany({ where: { id: { in: ids("club") } }, select: { id: true } }),
  ]);
  return new Set([...signups, ...clubs].map((r) => r.id));
}

function TargetName({ row, live }: { row: AuditLogRow; live: Set<string> }) {
  const href = row.targetId && live.has(row.targetId)
    ? row.targetType === "signup" ? `/signups/${row.targetId}` : row.targetType === "club" ? `/clubs/${row.targetId}` : null
    : null;
  const kind = { signup: "signup", club: "club", sport: "sport", word: "restricted word", staff: "portal user" }[row.targetType] ?? row.targetType;
  return (
    <>
      {href ? <Link href={href} className="text-blue-400 hover:underline">{row.targetLabel}</Link> : <span>{row.targetLabel}</span>}
      <span className="text-slate-500">{` (${kind})`}</span>
    </>
  );
}
