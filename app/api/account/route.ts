import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usersCol, type UserProfile } from "@/lib/server/db";
import { getSessionUser, setSessionCookie, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PATCH — the signed-in user updates their own profile / password / email. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: {
    action?: "profile" | "password" | "email";
    profile?: UserProfile;
    currentPassword?: string;
    newPassword?: string;
    newEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const users = await usersCol();

  if (body.action === "profile") {
    const p = body.profile ?? {};
    const clean: UserProfile = {
      fullName: p.fullName?.trim() || undefined,
      className: p.className?.trim() || undefined,
      section: p.section?.trim() || undefined,
      phone: p.phone?.trim() || undefined,
    };
    await users.updateOne({ email: me.email }, { $set: { profile: clean } });
    return NextResponse.json({ ok: true, profile: clean });
  }

  if (body.action === "password") {
    const current = body.currentPassword ?? "";
    const next = body.newPassword ?? "";
    if (!(await bcrypt.compare(current, me.passwordHash))) {
      return fail("Your current password is incorrect.");
    }
    if (next.length < 4) return fail("New password must be at least 4 characters long.");
    if (next === current) return fail("Please choose a different password.");
    await users.updateOne(
      { email: me.email },
      { $set: { passwordHash: await bcrypt.hash(next, 10) } }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "email") {
    const newEmail = (body.newEmail ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail)) return fail("Please enter a valid email address.");
    if (!(await bcrypt.compare(body.currentPassword ?? "", me.passwordHash))) {
      return fail("Your password is incorrect.");
    }
    if (newEmail === me.email) return fail("That's already your email address.");
    if (await users.findOne({ email: newEmail })) {
      return fail("Another account already uses that email.", 409);
    }
    await users.updateOne({ email: me.email }, { $set: { email: newEmail } });
    const res = NextResponse.json({ ok: true, email: newEmail, oldEmail: me.email });
    setSessionCookie(res, newEmail); // re-issue the cookie for the new email
    return res;
  }

  return fail("Unknown action.");
}
