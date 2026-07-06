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
    // The database is unreachable (e.g. MongoDB Atlas TLS/allow-list/network).
    // Surface a clear message instead of a blank 500 ("Request failed").
    console.error("[login] database connection failed:", err);
    return fail(
      "Can't reach the database. If you're running locally, your network may be blocking MongoDB — check your MongoDB Atlas Network Access allow-list (add 0.0.0.0/0) or try a different network.",
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
