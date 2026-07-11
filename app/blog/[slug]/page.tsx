import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPostsCol, type BlogPostDoc } from "@/lib/server/db";
import { Byline } from "@/components/BlogCard";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

async function getPost(slug: string): Promise<BlogPostDoc | null> {
  const col = await blogPostsCol();
  const hit = (await col.find({ slug }).toArray())[0];
  return hit && hit.published ? hit : null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const date = post.publishedAt ?? post.createdAt;

  return (
    <article className="pb-16">
      {/* Header */}
      <header className="bg-navy-radial text-white">
        <div className="container-page max-w-3xl py-14 sm:py-16">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-200 hover:text-white"
          >
            <ArrowRightIcon width={15} height={15} className="rotate-180" />
            All posts
          </Link>
          {post.tag && (
            <span className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
              {post.tag}
            </span>
          )}
          <h1 className="mt-3 font-serif text-3xl font-bold leading-tight sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-6">
            <Byline
              authorName={post.authorName}
              date={date}
              readingMinutes={post.readingMinutes}
              className="[&_*]:!text-navy-100"
            />
          </div>
        </div>
      </header>

      {/* Cover image */}
      {post.coverImage && (
        <div className="container-page max-w-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt=""
            className="-mt-8 w-full rounded-2xl border border-navy-100 object-cover shadow-diplomat sm:-mt-10"
          />
        </div>
      )}

      {/* Body */}
      <div className="container-page max-w-3xl">
        <div
          className="doc-content blog-article mt-10 text-[1.05rem] leading-8 text-navy-800"
          // Sanitized server-side on write (lib/server/blog-content.ts).
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <div className="mt-12 border-t border-navy-100 pt-8">
          <Link href="/blog" className="btn-ghost">
            <ArrowRightIcon width={16} height={16} className="rotate-180" />
            Back to all posts
          </Link>
        </div>
      </div>
    </article>
  );
}
