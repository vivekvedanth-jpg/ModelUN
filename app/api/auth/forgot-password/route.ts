import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { usersCol } from "@/lib/server/db";
import { fail } from "@/lib/server/session";
import { sendMail } from "@/lib/server/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = "https://letsmun.com";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESEND_COOLDOWN_MS = 60 * 1000; // don't re-send within a minute of the last request

/** The generic response either way — never reveals whether the email exists. */
const GENERIC_OK = NextResponse.json({
  ok: true,
  message: "If an account exists for that email, we've sent a password reset link.",
});

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return fail("Please enter your email address.");

  const users = await usersCol();
  const user = await users.findOne({ email });

  // No account, or a request came in within the last minute: still return the
  // generic success message, so the response never confirms which is true.
  if (!user) return GENERIC_OK;
  const cooldownStart = (user.resetTokenExpiresAt ?? 0) - TOKEN_TTL_MS;
  if (Date.now() - cooldownStart < RESEND_COOLDOWN_MS) return GENERIC_OK;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  await users.updateOne(
    { email },
    { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt } }
  );

  const link = `${SITE_URL}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;

  try {
    await sendMail({
      to: email,
      subject: "Reset your Let's MUN password",
      text: `We received a request to reset your Let's MUN password.\n\nReset it here (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <p>We received a request to reset your Let's MUN password.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#0f1e3d;color:#fbbf24;text-decoration:none;border-radius:8px;font-weight:bold;">Reset your password</a></p>
        <p>Or paste this link into your browser (valid for 1 hour):<br>${link}</p>
        <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("[forgot-password] failed to send email:", err);
    return fail("Couldn't send the reset email right now. Please try again shortly.", 500);
  }

  return GENERIC_OK;
}
