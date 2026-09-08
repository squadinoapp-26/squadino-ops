import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset.server";
import { sendEmail, passwordResetEmail, mailConfigured } from "@/lib/email";

// Same reply whether or not the address is registered, so this can't be used to
// discover which emails belong to platform staff.
const GENERIC = {
  ok: true,
  message: "If that email is registered, we've sent a link to reset your password.",
};

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  const address = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (!address) {
    return NextResponse.json({ error: "Enter your email address" }, { status: 400 });
  }

  const account = await prisma.platformUser.findFirst({ where: { email: address, active: true } });

  if (account) {
    const token = await createResetToken(address);
    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`;

    const msg = passwordResetEmail(resetUrl, RESET_TOKEN_TTL_MINUTES);
    await sendEmail({ ...msg, to: address });
  }

  // Flag the unconfigured-mail case so the UI can tell an admin where the link
  // went. This says nothing about whether the address exists.
  return NextResponse.json({ ...GENERIC, mailConfigured: mailConfigured() });
}
