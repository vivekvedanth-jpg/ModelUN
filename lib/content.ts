export interface Resource {
  id: string; title: string; type: string; format: string;
  desc: string; url?: string; seeded?: boolean;
  category?: string;
  subcategory?: string;
}

export interface Video {
  id: string; title: string; category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string; url?: string; seeded?: boolean;
  /** Position in the study plan (ascending). */
  order?: number;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getResources(): Promise<Resource[]> {
  const res = await api("/api/content?kind=resource");
  return ((await res.json()) as { resources: Resource[] }).resources;
}

export async function addResource(input: {
  title: string; type?: string; format?: string; desc?: string; url?: string;
  category?: string; subcategory?: string;
}): Promise<Resource> {
  const res = await api("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "resource", ...input }),
  });
  return ((await res.json()) as { resource: Resource }).resource;
}

/** Admin edits a resource's category/subcategory (and optionally title/desc). */
export async function updateResource(
  id: string,
  input: { category?: string; subcategory?: string; title?: string; desc?: string; type?: string }
): Promise<Resource> {
  const res = await api("/api/content", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: id, ...input }),
  });
  return ((await res.json()) as { resource: Resource }).resource;
}

export async function deleteResource(id: string): Promise<void> {
  await api(`/api/content?id=${encodeURIComponent(id)}&kind=resource`, { method: "DELETE" });
}

export async function getVideos(): Promise<Video[]> {
  const res = await api("/api/content?kind=video");
  return ((await res.json()) as { videos: Video[] }).videos;
}

export async function addVideo(input: {
  title: string; category?: string; level?: Video["level"]; duration?: string; url?: string;
}): Promise<Video> {
  const res = await api("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "video", ...input }),
  });
  return ((await res.json()) as { video: Video }).video;
}

export async function deleteVideo(id: string): Promise<void> {
  await api(`/api/content?id=${encodeURIComponent(id)}&kind=video`, { method: "DELETE" });
}

/** Save a new study-plan order (admin only). Returns the reordered videos. */
export async function reorderVideos(ids: string[]): Promise<Video[]> {
  const res = await api("/api/content", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: ids }),
  });
  return ((await res.json()) as { videos: Video[] }).videos;
}
