import { type NextRequest, NextResponse } from "next/server";
import {
  blogPostsCol,
  videosCol,
  resourcesCol,
} from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_TYPE = 20;

/** Strip HTML tags to plain text for matching (cheap, no sanitizer needed). */
function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) {
    return NextResponse.json({ query: "", blogs: [], videos: [], resources: [] });
  }

  const me = await getSessionUser(req);

  // Published blog posts are public — searchable by everyone.
  const posts = await (await blogPostsCol()).find({ published: true }).toArray();
  const blogs = posts
    .filter((p) => {
      const hay = `${p.title} ${p.excerpt} ${p.tag ?? ""} ${p.authorName} ${strip(p.html)}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
    .slice(0, MAX_PER_TYPE)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      tag: p.tag,
      authorName: p.authorName,
    }));

  // Videos + resources live behind the sign-in wall, so only search them for
  // signed-in users (results link into gated pages).
  let videos: { title: string; category: string; level: string; url?: string }[] = [];
  let resources: { title: string; desc: string; type: string; category?: string; url?: string }[] = [];

  if (me) {
    const [vids, res] = await Promise.all([
      (await videosCol()).find({}).toArray(),
      (await resourcesCol()).find({}).toArray(),
    ]);
    videos = vids
      .filter((v) => `${v.title} ${v.category} ${v.level}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_TYPE)
      .map((v) => ({ title: v.title, category: v.category, level: v.level, url: v.url }));
    resources = res
      .filter((r) =>
        `${r.title} ${r.desc} ${r.type} ${r.category ?? ""} ${r.subcategory ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, MAX_PER_TYPE)
      .map((r) => ({ title: r.title, desc: r.desc, type: r.type, category: r.category, url: r.url }));
  }

  return NextResponse.json({ query: q, blogs, videos, resources, signedIn: !!me });
}
