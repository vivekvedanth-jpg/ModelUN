import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  usersCol,
  experiencesCol,
  documentsCol,
  settingsCol,
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
  sweepExpiredGuests,
  emailPattern,
  fail,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: Record<Role, number> = {
  owner: 0,
  admin: 1,
  chair: 2,
  normal: 3,
  guest: 4,
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const GUEST_DEFAULT_MS = 7 * DAY_MS;

/** Clamp a guest expiry to a sane window: 1 hour to 90 days from now. */
function clampExpiry(ts: number, now = Date.now()): number {
  return Math.min(Math.max(ts, now + HOUR_MS), now + 90 * DAY_MS);
}

/** GET — list the accounts the signed-in admin/owner is allowed to see. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);

  // Expired guests vanish from admin lists the moment anyone looks.
  await sweepExpiredGuests();

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

  let body: {
    email?: string;
    password?: string;
    role?: Role;
    groupId?: string;
    expiresAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role ?? "normal";

  // Admins may create chairs for their own club; only the Owner creates admins.
  if (role === "admin") {
    if (!isOwnerDoc(me)) {
      return fail("Only the Owner can create admin accounts.", 403);
    }
  } else if (role !== "chair" && role !== "normal" && role !== "guest") {
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

  // Work out the group the new account belongs to. Chairs are scoped to a club
  // like everyone else, so a group-scoped admin's chairs land in that admin's
  // group and show up alongside its delegates.
  const actorCanAssign = canViewAllGroups(me!);
  const picked =
    body.groupId && body.groupId.trim() ? body.groupId.trim() : undefined;
  let groupId: string | undefined;
  if (actorCanAssign) {
    groupId = role === "admin" ? picked ?? ALL_GROUPS : picked;
  } else {
    groupId = me!.groupId; // group-scoped admin → new accounts join their group
  }

  // Only guests carry a self-destruct timestamp.
  let expiresAt: number | undefined;
  if (role === "guest") {
    const requested =
      typeof body.expiresAt === "number" && Number.isFinite(body.expiresAt)
        ? body.expiresAt
        : Date.now() + GUEST_DEFAULT_MS;
    expiresAt = clampExpiry(requested);
  }

  const doc: UserDoc = {
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    createdAt: Date.now(),
    groupId,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
  await users.insertOne(doc);
  return NextResponse.json({ account: toDetail(doc) });
}

/** PATCH — change an account's role/group (Owner) or a guest's expiry (any admin). */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);

  let body: {
    email?: string;
    role?: Role;
    groupId?: string | null;
    expiresAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  // Role and group changes stay Owner-only; only a guest's expiry may be
  // adjusted by regular admins.
  if ((body.role !== undefined || body.groupId !== undefined) && !isOwnerDoc(me)) {
    return fail("Only the Owner can change roles or groups.", 403);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const users = await usersCol();
  const target = await users.findOne({ email });
  if (!target) return fail("That account no longer exists.", 404);
  if (target.role === "owner") return fail("The Owner account can't be changed.");

  const update: Partial<UserDoc> = {};
  let unsetGroup = false;
  let unsetExpiry = false;

  if (body.role !== undefined) {
    if (!["admin", "chair", "normal", "guest"].includes(body.role)) {
      return fail("Invalid role.");
    }
    update.role = body.role;
    if (target.role === "guest" && body.role !== "guest") {
      // Promoted guests become permanent — drop the self-destruct timer.
      unsetExpiry = true;
    } else if (
      target.role !== "guest" &&
      body.role === "guest" &&
      target.expiresAt === undefined
    ) {
      update.expiresAt = clampExpiry(Date.now() + GUEST_DEFAULT_MS);
    }
  }

  if (body.expiresAt !== undefined) {
    if (typeof body.expiresAt !== "number" || !Number.isFinite(body.expiresAt)) {
      return fail("Invalid expiry timestamp.");
    }
    if ((update.role ?? target.role) !== "guest") {
      return fail("Only guest accounts have an expiry.");
    }
    update.expiresAt = clampExpiry(body.expiresAt);
    unsetExpiry = false;
  }

  if (body.groupId !== undefined) {
    const g = body.groupId && body.groupId.trim() ? body.groupId.trim() : null;
    if (g) update.groupId = g;
    else unsetGroup = true;
  }

  await users.updateOne(
    { email },
    {
      ...(Object.keys(update).length ? { $set: update } : {}),
      ...(unsetGroup || unsetExpiry
        ? {
            $unset: {
              ...(unsetGroup ? { groupId: "" } : {}),
              ...(unsetExpiry ? { expiresAt: "" } : {}),
            },
          }
        : {}),
    }
  );
  return NextResponse.json({ ok: true });
}

/** DELETE — remove an account (?email=...) and everything it owned. */
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
  if (target.role === "admin" && !isOwnerDoc(me)) {
    return fail("Only the Owner can delete admin accounts.", 403);
  }
  // Admins manage the chairs of their own club; the Owner manages any chair.
  if (
    target.role === "chair" &&
    !isOwnerDoc(me) &&
    !canViewAllGroups(me!) &&
    target.groupId !== me!.groupId
  ) {
    return fail("You can only manage chairs in your own group.", 403);
  }

  await users.deleteOne({ email });

  // Clean up the account's data so nothing orphaned lingers behind.
  const [experiences, documents, settings] = await Promise.all([
    experiencesCol(),
    documentsCol(),
    settingsCol(),
  ]);
  await Promise.all([
    experiences.deleteMany({ owner: emailPattern(email) }),
    documents.deleteMany({ owner: emailPattern(email) }),
  ]);
  // Drop the email from the pinned ranking order, if it's in there.
  const ranking = await settings.findOne({ key: "ranking_order" });
  if (ranking && Array.isArray(ranking.value)) {
    const next = (ranking.value as unknown[]).filter(
      (v) => typeof v !== "string" || v.toLowerCase() !== email
    );
    if (next.length !== ranking.value.length) {
      await settings.updateOne(
        { key: "ranking_order" },
        { $set: { value: next } }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
