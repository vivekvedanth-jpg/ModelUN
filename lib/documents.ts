export interface ResolutionDoc {
  id: string;
  owner: string;
  title: string;
  html: string;
  createdAt: number;
  updatedAt: number;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getDocuments(): Promise<ResolutionDoc[]> {
  const res = await api("/api/documents");
  return ((await res.json()) as { documents: ResolutionDoc[] }).documents;
}

export async function getDocument(id: string): Promise<ResolutionDoc | undefined> {
  try {
    const res = await api(`/api/documents/${encodeURIComponent(id)}`);
    return ((await res.json()) as { document: ResolutionDoc }).document;
  } catch {
    return undefined;
  }
}

export async function createDocument(title?: string): Promise<ResolutionDoc> {
  const res = await api("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return ((await res.json()) as { document: ResolutionDoc }).document;
}

export async function updateDocument(id: string, patch: { title?: string; html?: string }): Promise<void> {
  await api(`/api/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await api(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}
