import { type NextRequest, NextResponse } from "next/server";
import { documentsCol } from "@/lib/server/db";
import { getSessionUser, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — fetch one document (owner only). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const doc = await (await documentsCol()).findOne({ id: params.id });
  if (!doc) return fail("Not found.", 404);
  if (doc.owner.toLowerCase() !== me.email.toLowerCase()) return fail("Permission denied.", 403);

  return NextResponse.json({ document: doc });
}

/** PATCH — save title and/or html (owner only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: { title?: string; html?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

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

  const col = await documentsCol();
  const doc = await col.findOne({ id: params.id });
  if (!doc) return NextResponse.json({ ok: true });
  if (doc.owner.toLowerCase() !== me.email.toLowerCase()) return fail("Permission denied.", 403);

  await col.deleteOne({ id: params.id });
  return NextResponse.json({ ok: true });
}
