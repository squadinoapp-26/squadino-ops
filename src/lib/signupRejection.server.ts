import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/prismaErrors";
import { recordAudit } from "@/lib/auditLog.server";
import { ChangeError } from "@/lib/changeRequests.server";

export interface PendingRejection {
  requestId: string;
  signupId: string;
  reason: string;
  requestedByName: string;
  requestedByRole: string;
  createdAt: Date;
}

// A moderator's "reject this signup" is a request an admin has to approve. While it waits, the signup
// stays PENDING in the database, so these are the signups that must NOT show as ordinary new signups.
export async function listPendingRejections(): Promise<PendingRejection[]> {
  try {
    const rows = await prisma.changeRequest.findMany({
      where: { type: "SIGNUP_REJECT", status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return rows.flatMap((r) => {
      const p = r.payload as { signupId?: unknown; reason?: unknown } | null;
      if (!p || typeof p.signupId !== "string") return [];
      return [{
        requestId: r.id,
        signupId: p.signupId,
        reason: r.reason ?? (typeof p.reason === "string" ? p.reason : ""),
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

export async function pendingRejectionFor(signupId: string): Promise<PendingRejection | null> {
  return (await listPendingRejections()).find((r) => r.signupId === signupId) ?? null;
}

/** Puts a signup an admin already rejected back in the queue of signups waiting for review. */
export async function reinstateSignup(
  signupId: string,
  actor: { id: string; name: string; role: string },
  note: string | null,
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
    note: `Was rejected${signup.rejectionReason ? ` (reason: ${signup.rejectionReason})` : ""}${note ? ` · ${note}` : ""}`,
  });
}
