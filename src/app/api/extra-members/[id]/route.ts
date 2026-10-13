import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser, canDecideExtraMembers } from "@/lib/auth";
import { parseExtraMembersDecision } from "@/lib/extraMembers";
import { decideExtraMembers } from "@/lib/extraMembers.server";
import { ChangeError } from "@/lib/changeError";

// Approve or decline a club's request for extra members. Approving adds them to the club's Stripe
// subscription (done by the club app) and raises the club's member limit. Admins and moderators decide;
// customer care can only look.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getPlatformUser();
  if (!staff || !canDecideExtraMembers(staff.role)) {
    return NextResponse.json({ error: "Only admins and moderators can decide extra-member requests." }, { status: 403 });
  }

  const parsed = parseExtraMembersDecision(staff.role, await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await decideExtraMembers(id, parsed.decision, parsed.note, { id: staff.id, name: staff.name, role: staff.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
