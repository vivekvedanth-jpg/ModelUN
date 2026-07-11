import { type NextRequest, NextResponse } from "next/server";
import { blogPostsCol, type BlogPostDoc, type UserDoc } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";
import {
  sanitizeBlogHtml,
  slugify,
  deriveExcerpt,
  readingMinutes,
} from "@/lib/server/blog-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE_MAX = 160;
const EXCERPT_MAX = 300;
const TAG_MAX = 40;

/** Anyone who may author posts: all admins/owner, or a specifically granted account. */
function canWrite(u: UserDoc | null): boolean {
  return !!u && (isAdminDoc(u) || !!u.canWriteBlog);
}

/** May this user edit/delete this specific post? Author, or any admin/owner. */
function canManage(u: UserDoc, post: BlogPostDoc): boolean {
  return isAdminDoc(u) || post.authorEmail === u.email;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Ensure the slug is unique, appending -2, -3… on collision. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const col = await blogPostsCol();
  const all = await col.find({}).toArray();
  const taken = new Set(all.filter((p) => p.id !== exceptId).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${makeId()}`;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** GET — list posts. ?scope=mine returns the caller's manageable posts (incl.
 *  drafts); default returns published posts only (public). */
export async function GET(req: NextRequest) {
  const col = await blogPostsCol();
  const scope = req.nextUrl.searchParams.get("scope");

  if (scope === "mine") {
    const me = await getSessionUser(req);
    if (!canWrite(me)) return fail("You don't have permission to write blog posts.", 403);
    const all = await col.find({}).toArray();
    // Admins/owner manage everything; other authors manage their own posts.
    const mine = isAdminDoc(me)
      ? all
      : all.filter((p) => p.authorEmail === me!.email);
    mine.sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json({ posts: mine });
  }

  const posts = (await col.find({ published: true }).toArray()).sort(
    (a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt)
  );
  return NextResponse.json({ posts });
}

/** POST — create a post. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!canWrite(me)) return fail("You don't have permission to write blog posts.", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid request body."); }

  const title = str(body.title);
  if (!title) return fail("A title is required.");
  if (title.length > TITLE_MAX) return fail(`Titles are capped at ${TITLE_MAX} characters.`);

  const html = sanitizeBlogHtml(typeof body.html === "string" ? body.html : "");
  const tag = str(body.tag)?.slice(0, TAG_MAX);
  const excerpt =
    (str(body.excerpt)?.slice(0, EXCERPT_MAX)) ?? deriveExcerpt(html);
  const coverImage =
    typeof body.coverImage === "string" && body.coverImage.startsWith("data:image/")
      ? body.coverImage
      : undefined;
  const published = body.published === true;
  const now = Date.now();

  const doc: BlogPostDoc = {
    id: makeId(),
    slug: await uniqueSlug(slugify(title)),
    title,
    excerpt,
    coverImage,
    html,
    tag,
    authorEmail: me!.email,
    authorName: me!.profile?.fullName?.trim() || me!.email.split("@")[0],
    readingMinutes: readingMinutes(html),
    published,
    createdAt: now,
    updatedAt: now,
    ...(published ? { publishedAt: now } : {}),
  };

  await (await blogPostsCol()).insertOne(doc);
  return NextResponse.json({ post: doc }, { status: 201 });
}

/** PATCH — update a post (author or admin). Body must include id. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid request body."); }

  const id = str(body.id);
  if (!id) return fail("Missing post id.");

  const col = await blogPostsCol();
  const post = await col.find({ id }).toArray().then((r) => r[0]);
  if (!post) return fail("That post no longer exists.", 404);
  if (!canManage(me, post)) return fail("You can't edit this post.", 403);

  const update: Partial<BlogPostDoc> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    const title = str(body.title);
    if (!title) return fail("A title is required.");
    if (title.length > TITLE_MAX) return fail(`Titles are capped at ${TITLE_MAX} characters.`);
    update.title = title;
    if (title !== post.title) update.slug = await uniqueSlug(slugify(title), id);
  }
  if (body.html !== undefined) {
    const html = sanitizeBlogHtml(typeof body.html === "string" ? body.html : "");
    update.html = html;
    update.readingMinutes = readingMinutes(html);
    // Refresh a derived excerpt only if the author never set a custom one.
    if (body.excerpt === undefined && !post.excerpt) update.excerpt = deriveExcerpt(html);
  }
  if (body.excerpt !== undefined) update.excerpt = str(body.excerpt)?.slice(0, EXCERPT_MAX) ?? "";
  if (body.tag !== undefined) update.tag = str(body.tag)?.slice(0, TAG_MAX);
  if (body.coverImage !== undefined) {
    update.coverImage =
      typeof body.coverImage === "string" && body.coverImage.startsWith("data:image/")
        ? body.coverImage
        : undefined;
  }
  if (body.published !== undefined) {
    update.published = body.published === true;
    // Stamp publishedAt the first time it goes live.
    if (update.published && !post.publishedAt) update.publishedAt = Date.now();
  }

  await col.updateOne({ id }, { $set: update });
  return NextResponse.json({ post: { ...post, ...update } });
}

/** DELETE ?id=xxx — remove a post (author or admin). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing post id.");

  const col = await blogPostsCol();
  const post = await col.find({ id }).toArray().then((r) => r[0]);
  if (!post) return fail("That post no longer exists.", 404);
  if (!canManage(me, post)) return fail("You can't delete this post.", 403);

  await col.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
