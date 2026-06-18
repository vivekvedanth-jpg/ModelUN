import { type NextRequest, NextResponse } from "next/server";
import { questionsCol, type QuestionDoc } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — returns questions visible to the current user. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const col = await questionsCol();
  let docs: QuestionDoc[];

  if (isAdminDoc(me)) {
    docs = await col.find({}).toArray();
  } else {
    docs = await col.find({
      $or: [
        { visibility: "public" },
        { author: new RegExp(`^${me.email}$`, "i") },
      ],
    }).toArray();
  }

  docs.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ questions: docs });
}

/** POST — ask a question. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: { text?: string; visibility?: "public" | "private" };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const clean = body.text?.trim() ?? "";
  if (clean.length < 3) return fail("Your question is a little too short.");

  const doc: QuestionDoc = {
    id: makeId(),
    author: me.email,
    text: clean,
    visibility: body.visibility === "private" ? "private" : "public",
    createdAt: Date.now(),
  };
  await (await questionsCol()).insertOne(doc);
  return NextResponse.json({ question: doc }, { status: 201 });
}

/** PATCH — answer a question (admin only). */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Only admins can answer questions.", 403);

  let body: { id?: string; answer?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const clean = body.answer?.trim() ?? "";
  if (!body.id) return fail("Missing id.");
  if (!clean) return fail("Please write an answer first.");

  const col = await questionsCol();
  const q = await col.findOne({ id: body.id });
  if (!q) return fail("That question no longer exists.", 404);

  const updated: Partial<QuestionDoc> = {
    answer: clean,
    answeredBy: me.email,
    answeredAt: Date.now(),
  };
  await col.updateOne({ id: body.id }, { $set: updated });
  return NextResponse.json({ ok: true });
}

/** DELETE — delete a question (own or admin). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const col = await questionsCol();
  const q = await col.findOne({ id });
  if (!q) return NextResponse.json({ ok: true });

  const isAuthor = q.author.toLowerCase() === me.email.toLowerCase();
  if (!isAuthor && !isAdminDoc(me)) return fail("Permission denied.", 403);

  await col.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
