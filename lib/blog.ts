/** Client wrapper for the blog API. Reading is public; writing is gated. */

export type CommentPolicy = "off" | "signed-in" | "anyone";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  html: string;
  tag?: string;
  authorEmail: string;
  authorName: string;
  readingMinutes: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  commentPolicy?: CommentPolicy;
}

export interface BlogInput {
  title: string;
  html: string;
  excerpt?: string;
  tag?: string;
  coverImage?: string;
  published?: boolean;
  commentPolicy?: CommentPolicy;
}

export interface BlogComment {
  id: string;
  postId: string;
  authorName: string;
  body: string;
  createdAt: number;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? "Request failed.");
  }
  return data as T;
}

/** Posts the signed-in author can manage (their own, or all for admins). */
export async function getMyPosts(): Promise<BlogPost[]> {
  const { posts } = await api<{ posts: BlogPost[] }>("/api/blog?scope=mine");
  return posts;
}

export async function createPost(input: BlogInput): Promise<BlogPost> {
  const { post } = await api<{ post: BlogPost }>("/api/blog", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return post;
}

export async function updatePost(
  id: string,
  input: Partial<BlogInput>
): Promise<BlogPost> {
  const { post } = await api<{ post: BlogPost }>("/api/blog", {
    method: "PATCH",
    body: JSON.stringify({ id, ...input }),
  });
  return post;
}

export async function deletePost(id: string): Promise<void> {
  await api(`/api/blog?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ------------------------------- Comments ---------------------------------- */

export async function getComments(postId: string): Promise<BlogComment[]> {
  const { comments } = await api<{ comments: BlogComment[] }>(
    `/api/blog/comments?postId=${encodeURIComponent(postId)}`
  );
  return comments;
}

export async function addComment(
  postId: string,
  body: string,
  authorName?: string
): Promise<BlogComment> {
  const { comment } = await api<{ comment: BlogComment }>("/api/blog/comments", {
    method: "POST",
    body: JSON.stringify({ postId, body, authorName }),
  });
  return comment;
}

export async function deleteComment(id: string): Promise<void> {
  await api(`/api/blog/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
