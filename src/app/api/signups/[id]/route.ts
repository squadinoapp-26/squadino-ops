import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, canEditSignups } from "@/lib/auth";
import { parseSignupEdit, SIGNUP_EDIT_FIELDS } from "@/lib/signupEdit";
import { listSportNames } from "@/lib/sportCatalog.server";
import { diffFields } from "@/lib/auditLog";
import { recordAudit } from "@/lib/auditLog.server";

// The "Edit details" form on /signups/[id]: a super admin or admin
// corrects what the customer entered (spelling, email, package…) before the
// signup is approved. Once approved, the club has its own editor and the
// signup is a historical record, so only pending signups can be changed.
// Every saved change is stamped in the platform Logs with old → new values.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const editor = await getPlatformUser();
  if (!canEditSignups(editor?.role)) {
    return NextResponse.json({ error: "Only platform super admins and admins can edit signups." }, { status: 403 });
  }

  const signup = await prisma.signupRequest.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: "Signup request not found" }, { status: 404 });
  if (signup.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending signups can be edited." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseSignupEdit(body, signup, await listSportNames());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const changes = diffFields(signup, parsed.data, SIGNUP_EDIT_FIELDS);
  if (changes.length === 0) return NextResponse.json({ ok: true, changed: 0 });

  await prisma.signupRequest.update({ where: { id }, data: parsed.data });
  await recordAudit(editor, {
    action: "signup.edit",
    targetType: "signup",
    targetId: id,
    targetLabel: parsed.data.clubName,
    changes,
  });

  return NextResponse.json({ ok: true, changed: changes.length });
}
