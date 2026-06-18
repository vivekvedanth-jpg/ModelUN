import { type NextRequest, NextResponse } from "next/server";
import { messagesCol, type MessageDoc } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — admin reads the inbox. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  const docs = await (await messagesCol()).find({}).toArray();
  docs.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ messages: docs });
}

/** POST — anyone (no auth required) sends a contact message. */
export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; message?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !email || message.length < 5) {
    return fail("Please provide name, email, and a message (at least 5 chars).");
  }

  const doc: MessageDoc = { id: makeId(), name, email, message, createdAt: Date.now() };
  await (await messagesCol()).insertOne(doc);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE — admin removes a message. */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  await (await messagesCol()).deleteOne({ id });
  return NextResponse.json({ ok: true });
}
