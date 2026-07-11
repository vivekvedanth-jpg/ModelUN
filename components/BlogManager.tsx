"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { canWriteBlog, isAdmin } from "@/lib/auth";
import { getMyPosts, updatePost, deletePost, type BlogPost } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-format";
import { PlusIcon, TrashIcon, DocumentIcon } from "./icons";

export default function BlogManager() {
  const { user, loading } = useAuth();
  const allowed = canWriteBlog(user);
  const admin = isAdmin(user?.role);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const refresh = () =>
    getMyPosts().then(setPosts).catch((e) => setError(e.message)).finally(() => setReady(true));

  useEffect(() => {
    if (loading || !allowed) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allowed]);

  async function togglePublish(p: BlogPost) {
    try {
      await updatePost(p.id, { published: !p.published });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the post.");
    }
  }

  async function remove(p: BlogPost) {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    try {
      await deletePost(p.id);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the post.");
    }
  }

  if (!loading && !allowed) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-xl font-bold text-navy-900">Contributors only</h1>
          <p className="mt-2 text-navy-600">
            You don&apos;t have permission to write blog posts.
          </p>
          <Link href="/blog" className="btn-ghost mt-6 inline-flex">Back to the blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-4xl py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy-900">
            {admin ? "Manage blog posts" : "My blog posts"}
          </h1>
          <p className="mt-1 text-navy-600">
            {admin
              ? "Every post on the blog — edit, publish, unpublish, or delete."
              : "Your drafts and published posts."}
          </p>
        </div>
        <Link href="/blog/write" className="btn-gold">
          <PlusIcon width={16} height={16} /> Write a post
        </Link>
      </div>

      {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {ready && posts.length === 0 ? (
        <div className="mt-8 card flex flex-col items-center gap-2 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
            <DocumentIcon width={24} height={24} />
          </span>
          <p className="font-semibold text-navy-800">No posts yet</p>
          <p className="max-w-sm text-sm text-navy-500">
            Write your first post and share it with the community.
          </p>
          <Link href="/blog/write" className="btn-primary mt-3">
            <PlusIcon width={16} height={16} /> Write a post
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-100 bg-white px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-navy-900">{p.title}</h3>
                  <span className={`badge ${p.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-navy-500">
                  {admin && p.authorName ? `${p.authorName} · ` : ""}
                  Updated {formatBlogDate(p.updatedAt)}
                  {p.tag ? ` · ${p.tag}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {p.published && (
                  <Link href={`/blog/${p.slug}`} className="rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">
                    View
                  </Link>
                )}
                <Link href={`/blog/write?id=${p.id}`} className="rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">
                  Edit
                </Link>
                <button onClick={() => togglePublish(p)} className="rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">
                  {p.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => remove(p)} aria-label="Delete post" className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50">
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
