import { type NextRequest, NextResponse } from "next/server";
import { documentsCol, type ResolutionDocDb } from "@/lib/server/db";
import { getSessionUser, isGuestDoc, emailPattern, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 200;
// Generous cap so a document can embed a few (downscaled) images as data URLs.
const MAX_HTML = 3_000_000;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — list the signed-in delegate's documents. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  const docs = await (await documentsCol())
    .find({ owner: emailPattern(me.email) })
    .toArray();
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ documents: docs });
}

/** POST — create a new document (optionally seeded from a template's html). */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  let body: { title?: string; html?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  if (body.title !== undefined && typeof body.title !== "string") return fail("Invalid title.");
  if (body.html !== undefined && typeof body.html !== "string") return fail("Invalid document body.");
  if ((body.title ?? "").length > MAX_TITLE) return fail("Title is too long.");
  if ((body.html ?? "").length > MAX_HTML) return fail("Document is too large.");

  const now = Date.now();
  const doc: ResolutionDocDb = {
    id: makeId(),
    owner: me.email,
    title: body.title?.trim() || "Untitled resolution",
    html: body.html ?? "",
    createdAt: now,
    updatedAt: now,
  };
  await (await documentsCol()).insertOne(doc);
  return NextResponse.json({ document: doc }, { status: 201 });
}
