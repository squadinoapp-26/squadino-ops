import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canApproveChanges } from "@/lib/auth";
import { isMissingTable } from "@/lib/prismaErrors";
import { CHANGE_TYPES, REQUEST_STATUS_LABELS, describeChange, isChangeType, requestStatusLabel } from "@/lib/changeRequests";
import ApprovalActions from "./ApprovalActions";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-900 text-amber-300",
  APPROVED: "bg-green-900 text-green-300",
  REJECTED: "bg-slate-700 text-slate-300",
  FAILED: "bg-red-900 text-red-300",
};

// Changes to plans, user limits, billing and package prices wait here for an admin. Everyone who
// can sign in can see the list (so they can follow their own requests); only admins decide.
export default async function ApprovalsPage() {
  const staff = await requirePlatformSessionOrRedirect();
  const canDecide = canApproveChanges(staff.role);

  let pending: Awaited<ReturnType<typeof prisma.changeRequest.findMany>> = [];
  let recent: typeof pending = [];
  let missingTable = false;
  try {
    [pending, recent] = await Promise.all([
      prisma.changeRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
      prisma.changeRequest.findMany({ where: { status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 20 }),
    ]);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    missingTable = true;
  }

  const packages = await prisma.package.findMany({ select: { id: true, name: true } });
  const packageNames = Object.fromEntries(packages.map((p) => [p.id, p.name]));
  const label = (type: string) => (isChangeType(type) ? CHANGE_TYPES[type] : type);
  const describe = (type: string, payload: unknown) => (isChangeType(type) ? describeChange(type, payload, packageNames) : "");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Approvals</h1>
      </div>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <p className="text-sm text-slate-400">
          Changes to plans, user limits, billing and package prices need an admin, and so does the final approval or rejection of a new signup (always with a written reason). Moderators
          and customer care ask here; an admin approves (the change is made straight away) or rejects.
        </p>

        {missingTable && (
          <p className="rounded-xl bg-amber-950 text-amber-300 px-4 py-3 text-sm">
            The database update that adds approvals hasn&apos;t been run yet (<span className="font-mono">db-sync.cmd</span>).
          </p>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold">{`Waiting for approval (${pending.length})`}</h2>
          {pending.length === 0 && <p className="text-sm text-slate-500">Nothing is waiting.</p>}
          {pending.map((r) => (
            <div key={r.id} className="bg-slate-800 border border-amber-800/60 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{label(r.type)}: {r.targetLabel}</p>
                  <p className="text-sm text-slate-300 mt-0.5">{describe(r.type, r.payload)}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_TONE.PENDING}`}>{REQUEST_STATUS_LABELS.PENDING}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{`Asked by ${r.requestedByName} · ${when.format(r.createdAt)}`}</p>
              {r.reason && <p className="text-sm text-slate-300 mt-2">{`${r.type === "SIGNUP_PREAPPROVE" ? "Notes" : "Reason"}: ${r.reason}`}</p>}
              {canDecide ? <ApprovalActions id={r.id} type={r.type} /> :<p className="text-xs text-slate-500 mt-3">An admin will review this.</p>}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Recently decided</h2>
          {recent.length === 0 && <p className="text-sm text-slate-500">No decisions yet.</p>}
          {recent.map((r) => (
            <div key={r.id} className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{label(r.type)}: {r.targetLabel}</p>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_TONE[r.status] ?? STATUS_TONE.REJECTED}`}>{requestStatusLabel(r.type, r.status)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {`Asked by ${r.requestedByName}${r.decidedByName ? ` · decided by ${r.decidedByName}` : ""}${r.decidedAt ? ` · ${when.format(r.decidedAt)}` : ""}`}
              </p>
              {r.decisionNote && <p className="text-xs text-slate-400 mt-1">{r.decisionNote}</p>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
