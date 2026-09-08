import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { findValidResetToken, consumeResetToken } from "@/lib/passwordReset.server";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwordPolicy";
import { wasPasswordUsed, recordPasswordHistory } from "@/lib/passwordHistory";

// Checks a reset link before showing the form, so an expired or already-used
// link fails with a clear message rather than after typing a new password.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const row = await findValidResetToken(token);
  return NextResponse.json({ valid: !!row });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));

  const row = await findValidResetToken(typeof token === "string" ? token : "");
  if (!row) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const account = await prisma.platformUser.findFirst({ where: { email: row.email, active: true } });
  if (!account) {
    return NextResponse.json({ error: "No matching account found." }, { status: 400 });
  }

  if (await wasPasswordUsed(row.email, password, [account.passwordHash])) {
    return NextResponse.json({ error: "You've used that password before. Choose a different one." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // A reset often follows a compromise, so existing sessions shouldn't survive it.
  await prisma.$transaction([
    prisma.platformUser.update({ where: { id: account.id }, data: { passwordHash } }),
    prisma.platformSession.deleteMany({ where: { platformUserId: account.id } }),
  ]);
  await recordPasswordHistory(row.email, account.passwordHash);

  await consumeResetToken(row.id);

  return NextResponse.json({ ok: true, minLength: MIN_PASSWORD_LENGTH });
}
