import { type NextRequest, NextResponse } from "next/server";
import {
  blogPostsCol,
  blogCommentsCol,
  type BlogCommentDoc,
} from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_MAX = 2000;
const NAME_MAX = 60;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET ?postId=xxx — public list of a post's comments (oldest first). */
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) return fail("Missing postId.");

  const comments = (await (await blogCommentsCol()).find({ postId }).toArray())
    .sort((a, b) => a.createdAt - b.createdAt)
    // Never expose commenter emails publicly.
    .map(({ id, postId: pid, authorName, body, createdAt }) => ({
      id, postId: pid, authorName, body, createdAt,
    }));

  return NextResponse.json({ comments });
}

/** POST — add a comment, honouring the post's comment policy. */
export async function POST(req: NextRequest) {
  let body: { postId?: string; body?: string; authorName?: string };
  try { body = await req.json(); } catch { return fail("Invalid request body."); }

  const postId = (body.postId ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!postId) return fail("Missing postId.");
  if (!text) return fail("Please write a comment.");
  if (text.length > BODY_MAX) return fail(`Comments are capped at ${BODY_MAX} characters.`);

  const post = (await (await blogPostsCol()).find({ id: postId }).toArray())[0];
  if (!post || !post.published) return fail("That post no longer exists.", 404);

  const policy = post.commentPolicy ?? "signed-in";
  if (policy === "off") return fail("Comments are turned off for this post.", 403);

  const me = await getSessionUser(req);
  if (policy === "signed-in" && !me) {
    return fail("Please sign in to comment on this post.", 401);
  }

  // Signed-in commenters use their account identity; anonymous ones supply a name.
  let authorName: string;
  let authorEmail: string | undefined;
  if (me) {
    authorName = me.profile?.fullName?.trim() || me.email.split("@")[0];
    authorEmail = me.email;
  } else {
    authorName = (body.authorName ?? "").trim().slice(0, NAME_MAX) || "Guest";
  }

  const doc: BlogCommentDoc = {
    id: makeId(),
    postId,
    authorName,
    ...(authorEmail ? { authorEmail } : {}),
    body: text.slice(0, BODY_MAX),
    createdAt: Date.now(),
  };
  await (await blogCommentsCol()).insertOne(doc);

  // Echo back without the email.
  const { authorEmail: _omit, ...pub } = doc;
  void _omit;
  return NextResponse.json({ comment: pub }, { status: 201 });
}

/** DELETE ?id=xxx — remove a comment (admins, or the signed-in author). */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const col = await blogCommentsCol();
  const comment = (await col.find({ id }).toArray())[0];
  if (!comment) return fail("That comment no longer exists.", 404);

  const me = await getSessionUser(req);
  const isAuthor = !!me && !!comment.authorEmail && comment.authorEmail === me.email;
  if (!isAdminDoc(me) && !isAuthor) {
    return fail("You can't delete this comment.", 403);
  }

  await col.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
