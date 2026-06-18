import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usersCol, toDetail } from "@/lib/server/db";
import { setSessionCookie, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return fail("Please enter your email and password.");
  }

  const users = await usersCol();
  const user = await users.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail("Invalid email or password.", 401);
  }

  const res = NextResponse.json({ account: toDetail(user) });
  setSessionCookie(res, user.email);
  return res;
}
