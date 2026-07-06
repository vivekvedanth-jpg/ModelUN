/** Client wrappers for committee document sharing (/api/committee-files). */

export interface CommitteeFile {
  id: string;
  committeeId: string;
  name: string;
  mime: string;
  size: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: number;
}

/** Client-side upload cap (~4 MB), matched by the server. */
export const MAX_COMMITTEE_FILE_BYTES = 4 * 1024 * 1024;

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getCommitteeFiles(committeeId: string): Promise<CommitteeFile[]> {
  const res = await api(`/api/committee-files?committeeId=${encodeURIComponent(committeeId)}`);
  return ((await res.json()) as { files: CommitteeFile[] }).files;
}

/** Fetch one file including its inline data URL (for download / preview). */
export async function getCommitteeFileWithData(
  id: string
): Promise<CommitteeFile & { dataUrl: string }> {
  const res = await api(`/api/committee-files?id=${encodeURIComponent(id)}`);
  return ((await res.json()) as { file: CommitteeFile & { dataUrl: string } }).file;
}

export async function uploadCommitteeFile(input: {
  committeeId: string;
  name: string;
  mime: string;
  dataUrl: string;
}): Promise<CommitteeFile> {
  const res = await api("/api/committee-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return ((await res.json()) as { file: CommitteeFile }).file;
}

export async function deleteCommitteeFile(id: string): Promise<void> {
  await api(`/api/committee-files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
