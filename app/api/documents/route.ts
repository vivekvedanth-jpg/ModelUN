import { type NextRequest, NextResponse } from "next/server";
import { documentsCol, type ResolutionDocDb } from "@/lib/server/db";
import { getSessionUser, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — list the signed-in delegate's documents. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const docs = await (await documentsCol())
    .find({ owner: new RegExp(`^${me.email}$`, "i") })
    .toArray();
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ documents: docs });
}

/** POST — create a new document. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: { title?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const now = Date.now();
  const doc: ResolutionDocDb = {
    id: makeId(),
    owner: me.email,
    title: body.title?.trim() || "Untitled resolution",
    html: "",
    createdAt: now,
    updatedAt: now,
  };
  await (await documentsCol()).insertOne(doc);
  return NextResponse.json({ document: doc }, { status: 201 });
}
