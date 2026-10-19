import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canReviewSignups } from "@/lib/auth";
import { parseSignupEditRequest } from "@/lib/changeRequests";
import { submitChange } from "@/lib/changeRequests.server";
import { ChangeError } from "@/lib/changeError";
import { listSportNames } from "@/lib/sportCatalog.server";
import { signupEditSnapshot } from "@/lib/signupEdit";
import { pendingEditFor, pendingRequestFor } from "@/lib/signupReview.server";
import { recordAudit } from "@/lib/auditLog.server";

// The "Edit details" form on /signups/[id]: a customer made a mistake typing their details in, and staff correct it
// before the signup is approved (spelling, email, package…). Whoever corrects it gives a written reason. A super admin or
// admin makes the correction straight away; a moderator or customer care officer only SENDS it to an admin, who approves
// or declines it (see submitChange: the same rule every other sensitive change follows), and nothing changes until then.
// Once approved, the club has its own editor and the signup is a historical record, so only pending signups can be changed.
// Every step is stamped in the platform Logs, with old -> new values, the reason, and who did what.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const editor = await getPlatformUser();
  if (!editor || !canReviewSignups(editor.role)) {
    return NextResponse.json({ error: "Only platform staff can correct signups." }, { status: 403 });
  }

  const signup = await prisma.signupRequest.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending signups can be edited." }, { status: 409 });
  }
  // The details somebody already checked must not move under a decision that is waiting on them.
  if (await pendingRequestFor(id)) {
    return NextResponse.json(
      { error: "This signup is waiting for an admin to approve or reject it. An admin needs to decide that before its details can be changed." },
      { status: 409 },
    );
  }
  if (await pendingEditFor(id)) {
    return NextResponse.json({ error: "A correction to this signup is already waiting for an admin. An admin needs to decide that first." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseSignupEditRequest(id, body, signupEditSnapshot(signup), await listSportNames());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.changes.length === 0) return NextResponse.json({ ok: true, changed: 0 });

  try {
    const result = await submitChange(
      { type: "SIGNUP_EDIT", clubId: null, payload: parsed.payload, reason: parsed.reason, targetLabel: signup.clubName },
      editor,
    );
    if ("done" in result) return NextResponse.json({ ok: true, changed: parsed.changes.length });

    // The request itself is logged by submitChange; this line puts it on the signup's own history too.
    await recordAudit(editor, {
      action: "signup.edit_requested",
      targetType: "signup",
      targetId: id,
      targetLabel: signup.clubName,
      changes: parsed.changes,
      note: `Reason: ${parsed.reason}`,
    });
    return NextResponse.json({ ok: true, requested: true, changed: parsed.changes.length });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
