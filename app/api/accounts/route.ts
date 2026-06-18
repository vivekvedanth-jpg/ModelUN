import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  usersCol,
  toDetail,
  ALL_GROUPS,
  type Role,
  type UserDoc,
} from "@/lib/server/db";
import {
  getSessionUser,
  isAdminDoc,
  isOwnerDoc,
  canViewAllGroups,
  visibleAccountsFilter,
  fail,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, chair: 2, normal: 3 };

/** GET — list the accounts the signed-in admin/owner is allowed to see. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);

  const users = await usersCol();
  const docs = await users.find(visibleAccountsFilter(me!)).toArray();
  const accounts = docs
    .map(toDetail)
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.email.localeCompare(b.email)
    );
  return NextResponse.json({ accounts });
}

/** POST — create a new account. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);

  let body: { email?: string; password?: string; role?: Role; groupId?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role ?? "normal";

  if (role === "admin" || role === "chair") {
    if (!isOwnerDoc(me)) {
      return fail("Only the Owner can create admin or chair accounts.", 403);
    }
  } else if (role !== "normal") {
    return fail("Invalid role.");
  }
  if (!EMAIL_RE.test(email)) return fail("Please enter a valid email address.");
  if (password.length < 4) {
    return fail("Password must be at least 4 characters long.");
  }

  const users = await usersCol();
  if (await users.findOne({ email })) {
    return fail("An account with that email already exists.", 409);
  }

  // Work out the group the new account belongs to.
  const actorCanAssign = canViewAllGroups(me!);
  const picked =
    body.groupId && body.groupId.trim() ? body.groupId.trim() : undefined;
  let groupId: string | undefined;
  if (role === "chair") {
    groupId = undefined;
  } else if (actorCanAssign) {
    groupId = role === "admin" ? picked ?? ALL_GROUPS : picked;
  } else {
    groupId = me!.groupId; // group-scoped admin → new delegates join their group
  }

  const doc: UserDoc = {
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    createdAt: Date.now(),
    groupId,
  };
  await users.insertOne(doc);
  return NextResponse.json({ account: toDetail(doc) });
}

/** PATCH — Owner-only: change an account's role and/or group. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isOwnerDoc(me)) return fail("Only the Owner can change roles or groups.", 403);

  let body: { email?: string; role?: Role; groupId?: string | null };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const users = await usersCol();
  const target = await users.findOne({ email });
  if (!target) return fail("That account no longer exists.", 404);
  if (target.role === "owner") return fail("The Owner account can't be changed.");

  const update: Partial<UserDoc> = {};
  if (body.role !== undefined) {
    if (!["admin", "chair", "normal"].includes(body.role)) {
      return fail("Invalid role.");
    }
    update.role = body.role;
  }
  let unsetGroup = false;
  if (body.groupId !== undefined) {
    const g = body.groupId && body.groupId.trim() ? body.groupId.trim() : null;
    if (g) update.groupId = g;
    else unsetGroup = true;
  }

  await users.updateOne(
    { email },
    {
      ...(Object.keys(update).length ? { $set: update } : {}),
      ...(unsetGroup ? { $unset: { groupId: "" } } : {}),
    }
  );
  return NextResponse.json({ ok: true });
}

/** DELETE — remove an account (?email=...). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);

  const email = (new URL(req.url).searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();
  const users = await usersCol();
  const target = await users.findOne({ email });
  if (!target) return fail("That account no longer exists.", 404);
  if (target.role === "owner") return fail("The Owner account cannot be deleted.");
  if (target.email === me!.email) return fail("You cannot delete your own account.");
  if ((target.role === "admin" || target.role === "chair") && !isOwnerDoc(me)) {
    return fail("Only the Owner can delete admin or chair accounts.", 403);
  }

  await users.deleteOne({ email });
  return NextResponse.json({ ok: true });
}
