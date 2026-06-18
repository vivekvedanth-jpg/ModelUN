export interface ScoreColumn { id: string; label: string; }

export interface CommitteeDelegate {
  id: string;
  name: string;
  portfolio?: string;
  scores: Record<string, number>;
}

export interface SpeakerEntry { id: string; name: string; done: boolean; }

export interface Committee {
  id: string;
  chair: string;
  name: string;
  conference?: string;
  columns: ScoreColumn[];
  delegates: CommitteeDelegate[];
  speakers: SpeakerEntry[];
  currentSpeakerId?: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_COLUMN_LABELS = ["GSL", "Mod Caucus", "Unmod Caucus", "Resolution", "Diplomacy"];

/** Computes total score for a delegate across all committee columns. */
export function totalFor(committee: Committee, d: CommitteeDelegate): number {
  return committee.columns.reduce((sum, col) => sum + (d.scores[col.id] ?? 0), 0);
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

async function patch(body: Record<string, unknown>): Promise<Committee> {
  const res = await api("/api/committees", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return ((await res.json()) as { committee: Committee }).committee;
}

export async function getCommitteesForUser(): Promise<Committee[]> {
  const res = await api("/api/committees");
  return ((await res.json()) as { committees: Committee[] }).committees;
}

export async function getAllCommittees(): Promise<Committee[]> {
  return getCommitteesForUser();
}

export async function createCommittee(name?: string): Promise<Committee> {
  const res = await api("/api/committees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return ((await res.json()) as { committee: Committee }).committee;
}

export async function deleteCommittee(id: string): Promise<void> {
  await api(`/api/committees?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function renameCommittee(id: string, patch2: { name?: string; conference?: string }): Promise<Committee> {
  return patch({ id, action: "rename", ...patch2 });
}

export async function addColumn(id: string, label?: string): Promise<Committee> {
  return patch({ id, action: "add_column", label });
}

export async function renameColumn(id: string, columnId: string, label: string): Promise<Committee> {
  return patch({ id, action: "rename_column", columnId, label });
}

export async function removeColumn(id: string, columnId: string): Promise<Committee> {
  return patch({ id, action: "remove_column", columnId });
}

export async function addDelegate(id: string, input: { name: string; portfolio?: string }): Promise<Committee> {
  return patch({ id, action: "add_delegate", ...input });
}

export async function removeDelegate(id: string, delegateId: string): Promise<Committee> {
  return patch({ id, action: "remove_delegate", delegateId });
}

export async function setScore(id: string, delegateId: string, columnId: string, value: number | null): Promise<Committee> {
  return patch({ id, action: "set_score", delegateId, columnId, value });
}

export async function addSpeaker(id: string, name: string): Promise<Committee> {
  return patch({ id, action: "add_speaker", name });
}

export async function removeSpeaker(id: string, speakerId: string): Promise<Committee> {
  return patch({ id, action: "remove_speaker", speakerId });
}

export async function moveSpeaker(id: string, speakerId: string, dir: -1 | 1): Promise<Committee> {
  return patch({ id, action: "move_speaker", speakerId, dir });
}

export async function setCurrentSpeaker(id: string, speakerId: string | null): Promise<Committee> {
  return patch({ id, action: "set_current_speaker", speakerId });
}

export async function toggleSpeakerDone(id: string, speakerId: string): Promise<Committee> {
  return patch({ id, action: "toggle_speaker_done", speakerId });
}

export async function clearSpeakers(id: string): Promise<Committee> {
  return patch({ id, action: "clear_speakers" });
}

export async function setPublished(id: string, published: boolean): Promise<Committee> {
  return patch({ id, action: "set_published", published });
}
