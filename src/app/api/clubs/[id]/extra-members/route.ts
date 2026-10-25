import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { submitChange, ChangeError } from "@/lib/changeRequests.server";
import { cleanReason, parseExtraMembersRemove } from "@/lib/changeRequests";
import { approvedExtraMembersFor } from "@/lib/extraMembers.server";
import { assertClubAccess } from "@/lib/clubAccess.server";

// Taking extra members off a club (owner, 2026-10-24). Anyone who can sign in may ask; an admin's request is carried out straight away (the
// club app lowers the Stripe line and the club's member limit, and emails the club's admins if asked), anyone else's goes to the Approvals
// list (202). A reason is always required. Nobody already in the club is removed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // One customer care officer or moderator at a time per club: an admin always passes (see clubAccess.ts).
  const locked = await assertClubAccess(staff, id);
  if (locked) return locked;

  const body = await req.json().catch(() => ({}));
  const parsed = parseExtraMembersRemove(body, await approvedExtraMembersFor(id));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await submitChange({ type: "EXTRA_MEMBERS_REMOVE", clubId: id, payload: parsed.payload, reason: cleanReason(body.reason) }, staff);
    return NextResponse.json(result, { status: "requested" in result ? 202 : 200 });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
