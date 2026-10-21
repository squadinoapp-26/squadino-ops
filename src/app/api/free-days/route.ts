import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canApproveChanges, canPrepareFreeDays } from "@/lib/auth";
import { ChangeError } from "@/lib/changeError";
import { cleanReason } from "@/lib/changeRequests";
import { submitChange } from "@/lib/changeRequests.server";
import { daysWord, parseFreeDaysRequest } from "@/lib/freeDays";
import { grantCountsByKey } from "@/lib/freeDays.server";

// Free service days. An admin gives them now (the club app moves the payments and emails the clubs' admins); everyone else sends the
// request for an admin to approve. Either way a written reason is required and recorded with the person's name.
export async function POST(req: NextRequest) {
  const staff = await requirePlatformSession().catch(() => null);
  if (!staff || !canPrepareFreeDays(staff.role)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "That didn't come through. Try again." }, { status: 400 });

  const reason = cleanReason(body.reason);
  if (!reason) return NextResponse.json({ error: "Say why you are giving these free days. It is recorded with your name." }, { status: 400 });

  // The clubs come from the database, never from what the browser says their names are. Switched-off clubs can't be given free days.
  const ids = Array.isArray(body.clubIds) ? [...new Set(body.clubIds.filter((x): x is string => typeof x === "string"))] : [];
  if (ids.length === 0) return NextResponse.json({ error: "Choose at least one club." }, { status: 400 });
  const clubs = await prisma.club.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } });
  if (clubs.length !== ids.length) return NextResponse.json({ error: "One of the clubs you chose no longer exists. Reload the page and choose again." }, { status: 400 });
  const off = clubs.filter((c) => !c.active);
  if (off.length > 0) return NextResponse.json({ error: `${off.map((c) => c.name).slice(0, 3).join(", ")}${off.length > 3 ? " and others are" : off.length === 1 ? " is" : " are"} switched off, so can't be given free days. Untick ${off.length === 1 ? "it" : "them"}.` }, { status: 400 });

  const parsed = parseFreeDaysRequest(
    { title: body.title, whatHappened: body.whatHappened, whatWeAreDoing: body.whatWeAreDoing, extraNote: body.extraNote, dates: body.dates, clubs: clubs.map((c) => ({ id: c.id, name: c.name })) },
    new Date(),
  );
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const request = parsed.value;
  // What makes a direct submission happen once, even if the button is pressed twice.
  const submissionKey = typeof body.submissionKey === "string" && body.submissionKey.length >= 8 && body.submissionKey.length <= 100 ? body.submissionKey : null;
  if (canApproveChanges(staff.role) && !submissionKey) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });

  try {
    const result = await submitChange(
      {
        type: "FREE_DAYS",
        clubId: null,
        payload: request,
        reason,
        targetLabel: `${request.title} (${daysWord(request.dates.length)}, ${request.clubs.length} club${request.clubs.length === 1 ? "" : "s"})`,
        key: submissionKey ? `direct:${submissionKey}` : undefined,
      },
      staff,
    );
    if ("requested" in result) return NextResponse.json({ requested: true, id: result.id });
    const counts = submissionKey ? await grantCountsByKey(`direct:${submissionKey}`) : null;
    return NextResponse.json({ done: true, counts });
  } catch (e) {
    if (e instanceof ChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
