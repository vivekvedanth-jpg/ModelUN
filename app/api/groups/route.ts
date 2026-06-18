import { type NextRequest, NextResponse } from "next/server";
import { groupsCol, usersCol, type GroupDoc } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, isOwnerDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — list groups (any admin/owner can read, to show group names). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Not allowed.", 403);
  const groups = await (await groupsCol()).find({}).toArray();
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({
    groups: groups.map((g) => ({ id: g.id, name: g.name, createdAt: g.createdAt })),
  });
}

/** POST — Owner-only: create a group. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isOwnerDoc(me)) return fail("Only the Owner can create groups.", 403);

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }
  const name = (body.name ?? "").trim();
  if (!name) return fail("Please enter a group name.");

  const groups = await groupsCol();
  const existing = await groups.findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (existing) return fail("A group with that name already exists.", 409);

  const group: GroupDoc = { id: makeId(), name, createdAt: Date.now() };
  await groups.insertOne(group);
  return NextResponse.json({
    group: { id: group.id, name: group.name, createdAt: group.createdAt },
  });
}

/** DELETE — Owner-only: delete a group (?id=...) and unassign its members. */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isOwnerDoc(me)) return fail("Only the Owner can delete groups.", 403);

  const id = (new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return fail("Missing group id.");

  await (await groupsCol()).deleteOne({ id });
  // Ungroup any accounts that pointed at it (no accounts are deleted).
  await (await usersCol()).updateMany({ groupId: id }, { $unset: { groupId: "" } });
  return NextResponse.json({ ok: true });
}
