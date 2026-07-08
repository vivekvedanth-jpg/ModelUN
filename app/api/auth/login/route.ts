import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usersCol, toDetail } from "@/lib/server/db";
import { setSessionCookie, isGuestExpired, fail } from "@/lib/server/session";

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

  let user;
  try {
    const users = await usersCol();
    user = await users.findOne({ email });
  } catch (err) {
    // The local SQLite database couldn't be opened (e.g. the data directory
    // isn't writable). Surface a clear message instead of a blank 500.
    console.error("[login] database error:", err);
    return fail(
      "Can't open the database. Make sure the app's data directory is writable (SQLITE_PATH), then try again.",
      503
    );
  }

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail("Invalid email or password.", 401);
  }

  // Expired guest accounts self-destruct on their next sign-in attempt.
  if (isGuestExpired(user)) {
    const users = await usersCol();
    await users.deleteOne({ email: user.email });
    return fail("This temporary account has expired.", 401);
  }

  let res: NextResponse;
  try {
    res = NextResponse.json({ account: toDetail(user) });
    setSessionCookie(res, user.email);
  } catch (err) {
    // setSessionCookie throws if JWT_SECRET is missing.
    console.error("[login] session cookie failed:", err);
    return fail(
      "Server is missing its JWT_SECRET. Add JWT_SECRET to your environment and restart.",
      500
    );
  }
  return res;
}
