import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";
import { recordAudit } from "@/lib/auditLog.server";
import { ChangeError } from "@/lib/changeError";

export type SignupRequestKind = "REJECT" | "PREAPPROVE";

// What a moderator or customer care officer sent to the admins about a new signup, still waiting for a decision.
export interface PendingSignupRequest {
  kind: SignupRequestKind;
  requestId: string;
  signupId: string;
  // A rejection's reason, or a pre-approval's optional notes.
  text: string | null;
  // Pre-approvals only: the web address they picked and whether they checked the payment.
  slug: string | null;
  paymentChecked: boolean;
  requestedByName: string;
  requestedByRole: string;
  createdAt: Date;
}

// While a request waits, the signup stays PENDING in the database, so these are the signups that must NOT show as
// ordinary new signups, and must not be approved or rejected a second time.
export async function listPendingSignupRequests(): Promise<PendingSignupRequest[]> {
  try {
    const rows = await prisma.changeRequest.findMany({
      where: { type: { in: ["SIGNUP_REJECT", "SIGNUP_PREAPPROVE"] }, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return rows.flatMap((r) => {
      const p = r.payload as { signupId?: unknown; reason?: unknown; slug?: unknown; paymentChecked?: unknown; notes?: unknown } | null;
      if (!p || typeof p.signupId !== "string") return [];
      const kind: SignupRequestKind = r.type === "SIGNUP_PREAPPROVE" ? "PREAPPROVE" : "REJECT";
      return [{
        kind,
        requestId: r.id,
        signupId: p.signupId,
        text: r.reason ?? (typeof (kind === "REJECT" ? p.reason : p.notes) === "string" ? ((kind === "REJECT" ? p.reason : p.notes) as string) : null),
        slug: typeof p.slug === "string" ? p.slug : null,
        paymentChecked: p.paymentChecked === true,
        requestedByName: r.requestedByName,
        requestedByRole: r.requestedByRole,
        createdAt: r.createdAt,
      }];
    });
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export async function pendingRequestFor(signupId: string): Promise<PendingSignupRequest | null> {
  return (await listPendingSignupRequests()).find((r) => r.signupId === signupId) ?? null;
}

/** Puts a signup an admin already rejected back in the queue of signups waiting for review. A reason is required. */
export async function reinstateSignup(
  signupId: string,
  actor: { id: string; name: string; role: string },
  reason: string,
): Promise<void> {
  const signup = await prisma.signupRequest.findUnique({ where: { id: signupId }, select: { clubName: true, rejectionReason: true } });
  if (!signup) throw new ChangeError("Signup not found", 404);
  const done = await prisma.signupRequest.updateMany({
    where: { id: signupId, status: "REJECTED" },
    data: { status: "PENDING", reviewedAt: null, reviewedByPlatformUserId: null, rejectionReason: null },
  });
  if (done.count === 0) throw new ChangeError("Only a rejected signup can be re-instated.", 409);
  await recordAudit(actor, {
    action: "signup.reinstate",
    targetType: "signup",
    targetId: signupId,
    targetLabel: signup.clubName,
    note: `Was rejected${signup.rejectionReason ? ` (reason: ${signup.rejectionReason})` : ""} · Admin's reason: ${reason}`,
  });
}

export interface SignupHistoryEntry {
  id: string;
  createdAt: Date;
  action: string;
  actorName: string;
  actorRole: string;
  note: string | null;
}

/**
 * Everything done to one signup, oldest first: who did it (name and role as they were at the time), when, and the
 * reason or notes they gave. Read-only. It comes from the Logs, which can only ever be added to.
 */
export async function listSignupHistory(signupId: string): Promise<SignupHistoryEntry[]> {
  try {
    return await prisma.platformAuditLog.findMany({
      where: { targetType: "signup", targetId: signupId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, action: true, actorName: true, actorRole: true, note: true },
    });
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}
