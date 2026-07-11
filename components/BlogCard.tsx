import Link from "next/link";
import { formatBlogDate, authorAccent } from "@/lib/blog-format";
import type { BlogPost } from "@/lib/blog";

/** Small author + date + reading-time byline used on cards and articles. */
export function Byline({
  authorName,
  date,
  readingMinutes,
  className = "",
}: {
  authorName: string;
  date: number;
  readingMinutes: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 text-sm ${className}`}>
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${authorAccent(
          authorName
        )}`}
      >
        {authorName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold text-navy-800">{authorName}</div>
        <div className="text-xs text-navy-500">
          {formatBlogDate(date)} · {readingMinutes} min read
        </div>
      </div>
    </div>
  );
}

/** A standard blog card for the grid. */
export default function BlogCard({ post }: { post: BlogPost }) {
  const date = post.publishedAt ?? post.createdAt;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="card-hover group flex flex-col overflow-hidden !p-0"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-navy-radial">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-serif text-2xl font-bold text-white/25">
              Let&apos;s MUN
            </span>
          </div>
        )}
        {post.tag && (
          <span className="badge absolute left-3 top-3 bg-white/90 text-navy-800 backdrop-blur">
            {post.tag}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-lg font-bold leading-snug text-navy-900 group-hover:text-navy-700">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-navy-600">
          {post.excerpt}
        </p>
        <Byline
          authorName={post.authorName}
          date={date}
          readingMinutes={post.readingMinutes}
          className="mt-4 border-t border-navy-100 pt-4"
        />
      </div>
    </Link>
  );
}
