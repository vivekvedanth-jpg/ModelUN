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
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > 80) {
    return fail("Please provide your name (up to 80 characters).");
  }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Please provide a valid email address (up to 120 characters).");
  }
  if (message.length < 5 || message.length > 2000) {
    return fail("Your message must be between 5 and 2000 characters.");
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
