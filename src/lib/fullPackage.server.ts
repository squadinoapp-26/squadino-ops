import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";
import { recordAudit } from "@/lib/auditLog.server";
import { ChangeError } from "@/lib/changeError";
import { ClubAppError, runFullPackageAction } from "@/lib/clubBillingApi.server";
import { formatMoney, type FullAction } from "@/lib/fullPackage";

// What the dashboard box shows. Dates are text so the box (a client component) can take it as it is.
export interface FullRequestItem {
  id: string;
  status: "REQUESTED" | "PROCESSING" | "QUOTED";
  clubName: string;
  registeredName: string | null;
  orgType: string;
  sports: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  estimatedUsers: number;
  interval: "monthly" | "yearly";
  createdAt: string;
  quotedUsers: number | null;
  perUserCents: number | null;
  periodCents: number | null;
  quoteNote: string | null;
  quotedByName: string | null;
  quotedAt: string | null;
  invoiceUrl: string | null;
  invoiceDueAt: string | null;
}

/** Requests for the Full package that are still open: waiting for a price, or invoiced and waiting to be paid. */
export async function listOpenFullRequests(): Promise<FullRequestItem[]> {
  try {
    const rows = await prisma.fullPackageRequest.findMany({
      where: { status: { in: ["REQUESTED", "PROCESSING", "QUOTED"] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status as FullRequestItem["status"],
      clubName: r.clubName,
      registeredName: r.registeredName,
      orgType: r.orgType,
      sports: r.sports,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      estimatedUsers: r.estimatedUsers,
      interval: r.interval === "yearly" ? "yearly" : "monthly",
      createdAt: r.createdAt.toISOString(),
      quotedUsers: r.quotedUsers,
      perUserCents: r.perUserCents,
      periodCents: r.periodCents,
      quoteNote: r.quoteNote,
      quotedByName: r.quotedByName,
      quotedAt: r.quotedAt?.toISOString() ?? null,
      invoiceUrl: r.invoiceUrl,
      invoiceDueAt: r.invoiceDueAt?.toISOString() ?? null,
    }));
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

/**
 * Sends the invoice, cancels one, or closes a request. The club app does the real work (it holds the Stripe key and
 * emails the customer); ops checks who is allowed, then writes the Logs entry once the club app says it is done.
 */
export async function runFullAction(
  requestId: string,
  action: FullAction,
  actor: { id: string; name: string; role: string },
): Promise<void> {
  let req;
  try {
    req = await prisma.fullPackageRequest.findUnique({ where: { id: requestId }, select: { id: true, clubName: true, interval: true } });
  } catch (e) {
    if (isMissingTable(e)) throw new ChangeError("The database update for the Full package hasn't been run yet.", 503);
    throw e;
  }
  if (!req) throw new ChangeError("Request not found", 404);

  const by = { name: actor.name, role: actor.role };
  let result: { periodCents?: number } = {};
  try {
    if (action.kind === "send_invoice") {
      result = await runFullPackageAction(req.id, "send_invoice", by, action.note, { users: action.users, perMemberCents: action.perMemberCents });
    } else {
      await runFullPackageAction(req.id, action.kind, by, action.note);
    }
  } catch (e) {
    if (e instanceof ClubAppError) throw new ChangeError(e.message, e.status >= 500 ? 502 : e.status);
    throw e;
  }

  const entry = { targetType: "request" as const, targetId: req.id, targetLabel: req.clubName };
  if (action.kind === "send_invoice") {
    const per = req.interval === "yearly" ? "year" : "month";
    await recordAudit(actor, {
      ...entry,
      action: "full.invoice_sent",
      note: [
        `${action.users.toLocaleString("en-AU")} members at ${formatMoney(action.perMemberCents)} per member per month, billed ${req.interval}${result.periodCents != null ? `: ${formatMoney(result.periodCents)} a ${per}` : ""}`,
        `Reason: ${action.note}`,
      ].join(" · "),
    });
  } else if (action.kind === "cancel_invoice") {
    await recordAudit(actor, { ...entry, action: "full.invoice_cancelled", note: `Reason: ${action.note}` });
  } else {
    await recordAudit(actor, { ...entry, action: "full.closed", note: `Reason: ${action.note}` });
  }
}
