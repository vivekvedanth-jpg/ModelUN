import type { Metadata } from "next";
import Link from "next/link";
import { blogPostsCol, type BlogPostDoc } from "@/lib/server/db";
import type { BlogPost } from "@/lib/blog";
import BlogAuthorBar from "@/components/BlogAuthorBar";
import BlogCard, { Byline } from "@/components/BlogCard";
import { BookIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights, guides, and stories on Model United Nations — from public speaking and resolution writing to conference recaps — by the Let's MUN community.",
  alternates: { canonical: "/blog" },
};

/** Strip server-only fields we don't want to hand to client components. */
function toPost(d: BlogPostDoc): BlogPost {
  return d as BlogPost;
}

export default async function BlogIndexPage() {
  const col = await blogPostsCol();
  const posts = (await col.find({ published: true }).toArray())
    .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
    .map(toPost);

  const [featured, ...rest] = posts;

  return (
    <>
      {/* Hero */}
      <section className="bg-navy-radial text-white">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow !text-gold-400">
            <span className="h-px w-8 bg-gold-400" /> The Let&apos;s MUN Blog
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Ideas &amp; insight from the world of Model UN
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-navy-200">
            Guides, conference recaps, and reflections on diplomacy — written by
            our delegates, chairs, and mentors.
          </p>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <BlogAuthorBar />

        {posts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Featured (latest) */}
            {featured && <FeaturedPost post={featured} />}

            {/* The rest */}
            {rest.length > 0 && (
              <>
                <h2 className="mb-6 mt-14 font-serif text-2xl font-bold text-navy-900">
                  More from the blog
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <BlogCard key={p.id} post={p} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

function FeaturedPost({ post }: { post: BlogPost }) {
  const date = post.publishedAt ?? post.createdAt;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="card-hover group grid gap-0 overflow-hidden !p-0 md:grid-cols-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-radial md:aspect-auto">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <span className="font-serif text-3xl font-bold text-white/25">Let&apos;s MUN</span>
          </div>
        )}
        <span className="badge absolute left-4 top-4 bg-gold-500 text-navy-900">
          Latest
        </span>
      </div>
      <div className="flex flex-col justify-center p-7 sm:p-9">
        {post.tag && (
          <span className="text-xs font-semibold uppercase tracking-wide text-gold-600">
            {post.tag}
          </span>
        )}
        <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-navy-900 group-hover:text-navy-700 sm:text-3xl">
          {post.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-navy-600">{post.excerpt}</p>
        <Byline
          authorName={post.authorName}
          date={date}
          readingMinutes={post.readingMinutes}
          className="mt-6"
        />
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800">
          Read article
          <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center gap-3 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
        <BookIcon width={28} height={28} />
      </span>
      <h2 className="font-serif text-2xl font-bold text-navy-900">
        No posts yet
      </h2>
      <p className="max-w-md text-navy-600">
        Our blog is just getting started. Check back soon for guides, recaps, and
        insights from the Let&apos;s MUN community.
      </p>
    </div>
  );
}
