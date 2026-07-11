/** Client wrapper for the blog API. Reading is public; writing is gated. */

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
}

export interface BlogInput {
  title: string;
  html: string;
  excerpt?: string;
  tag?: string;
  coverImage?: string;
  published?: boolean;
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
