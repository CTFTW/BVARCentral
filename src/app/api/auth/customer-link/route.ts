import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/mailer";

/**
 * Issues a single-use, short-lived magic-link token for customer portal
 * access. Always returns 200 to avoid leaking which emails are registered.
 */
export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.role === "CUSTOMER" && user.active) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    const url = `${process.env.NEXTAUTH_URL}/portal/verify?token=${token}`;
    await sendMagicLinkEmail(email, url);
  }

  return NextResponse.json({ ok: true });
}
