import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { usersCol } from "@/lib/server/db";
import { fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time hash comparison — avoids leaking a timing side-channel. */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const token = body.token ?? "";
  const newPassword = body.newPassword ?? "";

  if (!email || !token) return fail("This reset link is invalid or has expired.");
  if (newPassword.length < 4) {
    return fail("Password must be at least 4 characters long.");
  }

  const users = await usersCol();
  const user = await users.findOne({ email });

  if (
    !user ||
    !user.resetTokenHash ||
    !user.resetTokenExpiresAt ||
    Date.now() > user.resetTokenExpiresAt
  ) {
    return fail("This reset link is invalid or has expired.", 400);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (!hashesMatch(tokenHash, user.resetTokenHash)) {
    return fail("This reset link is invalid or has expired.", 400);
  }

  await users.updateOne(
    { email },
    {
      $set: { passwordHash: await bcrypt.hash(newPassword, 10) },
      $unset: { resetTokenHash: "", resetTokenExpiresAt: "" },
    }
  );

  return NextResponse.json({ ok: true });
}
