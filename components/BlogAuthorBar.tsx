"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { canWriteBlog } from "@/lib/auth";
import { PlusIcon, DocumentIcon } from "./icons";

/**
 * The author toolbar shown above the blog — only to accounts allowed to write.
 * Everyone else (including logged-out visitors) sees nothing here.
 */
export default function BlogAuthorBar() {
  const { user, loading } = useAuth();
  if (loading || !canWriteBlog(user)) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-300 bg-gold-50/70 px-5 py-4">
      <p className="text-sm text-navy-700">
        <span className="font-semibold text-navy-900">You&apos;re a contributor.</span>{" "}
        Share an insight, a recap, or a guide with the community.
      </p>
      <div className="flex items-center gap-2">
        <Link href="/blog/manage" className="btn-ghost !px-4 !py-2 text-sm">
          <DocumentIcon width={16} height={16} /> My posts
        </Link>
        <Link href="/blog/write" className="btn-gold !px-4 !py-2 text-sm">
          <PlusIcon width={16} height={16} /> Write a post
        </Link>
      </div>
    </div>
  );
}
