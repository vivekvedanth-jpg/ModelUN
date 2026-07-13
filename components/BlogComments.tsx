"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import {
  getComments,
  addComment,
  deleteComment,
  type BlogComment,
  type CommentPolicy,
} from "@/lib/blog";
import { authorAccent } from "@/lib/blog-format";
import { ChatIcon, TrashIcon } from "./icons";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function BlogComments({
  postId,
  policy,
}: {
  postId: string;
  policy: CommentPolicy;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getComments(postId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [postId]);

  const canPost = policy === "anyone" || (policy === "signed-in" && !!user);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!body.trim()) { setError("Please write a comment."); return; }
    setSubmitting(true);
    try {
      const created = await addComment(postId, body.trim(), user ? undefined : name.trim());
      setComments((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post your comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(c: BlogComment) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the comment.");
    }
  }

  return (
    <section className="mt-14 border-t border-navy-100 pt-10">
      <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-navy-900">
        <ChatIcon width={22} height={22} />
        {comments.length > 0 ? `${comments.length} ` : ""}
        Comment{comments.length === 1 ? "" : "s"}
      </h2>

      {/* Comment form / gating message */}
      <div className="mt-6">
        {policy === "off" ? (
          <p className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-sm text-navy-600">
            Comments are turned off for this post.
          </p>
        ) : !canPost ? (
          <p className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-sm text-navy-600">
            Please{" "}
            <Link href="/signin" className="font-semibold text-navy-800 underline">
              sign in
            </Link>{" "}
            to join the conversation.
          </p>
        ) : (
          <form onSubmit={submit} className="card space-y-3">
            {policy === "anyone" && !user && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="input-field"
                maxLength={60}
              />
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="input-field min-h-[96px] resize-y"
              maxLength={2000}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-navy-400">
                {policy === "anyone"
                  ? "Anyone can comment on this post."
                  : "Commenting as " + (user ? user.email.split("@")[0] : "you")}
              </span>
              <button type="submit" disabled={submitting} className="btn-primary !px-5 !py-2 text-sm">
                {submitting ? "Posting…" : "Post comment"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Comment list */}
      <div className="mt-8 space-y-5">
        {loaded && comments.length === 0 && (
          <p className="text-sm text-navy-500">
            No comments yet{policy !== "off" ? " — be the first to share your thoughts." : "."}
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${authorAccent(
                c.authorName
              )}`}
            >
              {c.authorName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy-900">{c.authorName}</span>
                <span className="text-xs text-navy-400">{timeAgo(c.createdAt)}</span>
                {admin && (
                  <button
                    onClick={() => remove(c)}
                    aria-label="Delete comment"
                    className="ml-auto rounded p-1 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                )}
              </div>
              {/* Rendered as text — React escapes it, so comments can't inject markup. */}
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-navy-700">
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
