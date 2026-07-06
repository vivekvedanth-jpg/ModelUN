import { type NextRequest, NextResponse } from "next/server";
import { documentsCol } from "@/lib/server/db";
import { getSessionUser, isGuestDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 200;
const MAX_HTML = 500_000;

/** GET — fetch one document (owner only). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  const doc = await (await documentsCol()).findOne({ id: params.id });
  if (!doc) return fail("Not found.", 404);
  if (doc.owner.toLowerCase() !== me.email.toLowerCase()) return fail("Permission denied.", 403);

  return NextResponse.json({ document: doc });
}

/** PATCH — save title and/or html (owner only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  let body: { title?: string; html?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  if (body.title !== undefined && typeof body.title !== "string") return fail("Invalid title.");
  if (body.html !== undefined && typeof body.html !== "string") return fail("Invalid document body.");
  if ((body.title ?? "").length > MAX_TITLE) return fail("Title is too long.");
  if ((body.html ?? "").length > MAX_HTML) return fail("Document is too large.");

  const col = await documentsCol();
  const doc = await col.findOne({ id: params.id });
  if (!doc) return fail("Not found.", 404);
  if (doc.owner.toLowerCase() !== me.email.toLowerCase()) return fail("Permission denied.", 403);

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.title !== undefined) patch.title = body.title.trim() || "Untitled resolution";
  if (body.html !== undefined) patch.html = body.html;

  await col.updateOne({ id: params.id }, { $set: patch });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a document (owner only). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  const col = await documentsCol();
  const doc = await col.findOne({ id: params.id });
  if (!doc) return NextResponse.json({ ok: true });
  if (doc.owner.toLowerCase() !== me.email.toLowerCase()) return fail("Permission denied.", 403);

  await col.deleteOne({ id: params.id });
  return NextResponse.json({ ok: true });
}
