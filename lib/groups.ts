/**
 * Client-side groups API (e.g. a MUN club, school, or university).
 *
 * Groups live in the server's SQLite database so admin/group assignments work
 * across devices. These are async fetch wrappers; the server enforces that only
 * the Owner can create or delete groups.
 */

export interface Group {
  id: string;
  name: string;
  createdAt: number;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || "Request failed.";
    throw new Error(msg);
  }
  return data as T;
}

export async function getGroups(): Promise<Group[]> {
  const { groups } = await api<{ groups: Group[] }>("/api/groups");
  return groups;
}

export async function createGroup(name: string): Promise<Group> {
  const { group } = await api<{ group: Group }>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  await api(`/api/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
