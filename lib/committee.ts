export interface ScoreColumn { id: string; label: string; }

export interface CommitteeDelegate {
  id: string;
  name: string;
  portfolio?: string;
  scores: Record<string, number>;
  /** Linked account email, if this delegate has a login. */
  email?: string;
}

export interface SpeakerEntry { id: string; name: string; done: boolean; }

export type VoteThreshold = "simple" | "twothirds";

/** Vote as the server sends it to the current viewer (ballots are never exposed). */
export interface VoteView {
  id: string;
  title: string;
  threshold: VoteThreshold;
  startedAt: number;
  durationSec: number;
  closed: boolean;
  voterCount: number;
  myVote: "yes" | "no" | null;
  /** Present for chairs always, and for everyone once the vote is decided. */
  tally: { yes: number; no: number; total: number } | null;
}

export interface CommitteeMessage {
  id: string;
  authorEmail: string;
  authorName: string;
  toEmail?: string;
  text: string;
  createdAt: number;
}

export interface SessionStatus {
  label: string;
  startedAt: number;
  durationSec?: number;
}

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
  vote?: VoteView | null;
  messages?: CommitteeMessage[];
  session?: SessionStatus | null;
  createdAt: number;
  updatedAt: number;
  /** True if the current viewer may run/score this committee. */
  canManage?: boolean;
}

export interface RosterAccount {
  email: string;
  name: string;
  role: "owner" | "admin" | "chair" | "normal";
}

export const DEFAULT_COLUMN_LABELS = ["GSL", "Mod Caucus", "Unmod Caucus", "Resolution", "Diplomacy"];

/** Committee vote timer caps. */
export const MAX_VOTE_SECONDS = 120;

/** Computes total score for a delegate across all committee columns. */
export function totalFor(committee: Committee, d: CommitteeDelegate): number {
  return committee.columns.reduce((sum, col) => sum + (d.scores[col.id] ?? 0), 0);
}

/* ───────────────────────── Pure vote/timer helpers ───────────────────────── */

export function voteDeadline(v: VoteView): number {
  return v.startedAt + v.durationSec * 1000;
}

/** True once the vote is over (closed early or the timer ran out). */
export function voteDecided(v: VoteView, now = Date.now()): boolean {
  return v.closed || now >= voteDeadline(v);
}

export function voteSecondsLeft(v: VoteView, now = Date.now()): number {
  return Math.max(0, Math.ceil((voteDeadline(v) - now) / 1000));
}

/** Pass/fail from a tally + threshold. Needs at least one vote to pass. */
export function votePassed(
  threshold: VoteThreshold,
  tally: { yes: number; no: number; total: number }
): boolean {
  if (tally.total <= 0) return false;
  return threshold === "twothirds"
    ? tally.yes * 3 >= tally.total * 2
    : tally.yes * 2 > tally.total;
}

export function thresholdLabel(t: VoteThreshold): string {
  return t === "twothirds" ? "Two-thirds majority" : "Simple majority (50% + 1)";
}

/* ──────────────────────────────── API client ─────────────────────────────── */

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

/** Accounts the chair can add as delegates. */
export async function getRoster(): Promise<RosterAccount[]> {
  const res = await api("/api/committees?accounts=1");
  return ((await res.json()) as { accounts: RosterAccount[] }).accounts;
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

export async function addDelegate(
  id: string,
  input: { name?: string; portfolio?: string; email?: string }
): Promise<Committee> {
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

/* ── Voting ── */

export async function startVote(
  id: string,
  input: { title: string; threshold: VoteThreshold; durationSec: number }
): Promise<Committee> {
  return patch({ id, action: "start_vote", ...input });
}

export async function castVote(id: string, choice: "yes" | "no"): Promise<Committee> {
  return patch({ id, action: "cast_vote", choice });
}

export async function extendVote(id: string, addSec: number): Promise<Committee> {
  return patch({ id, action: "extend_vote", addSec });
}

export async function closeVote(id: string): Promise<Committee> {
  return patch({ id, action: "close_vote" });
}

export async function clearVote(id: string): Promise<Committee> {
  return patch({ id, action: "clear_vote" });
}

/* ── Messaging ── */

export async function sendCommitteeMessage(
  id: string,
  text: string,
  toEmail?: string
): Promise<Committee> {
  return patch({ id, action: "send_message", text, toEmail });
}

export async function clearCommitteeMessages(id: string): Promise<Committee> {
  return patch({ id, action: "clear_messages" });
}

/* ── Session status ── */

export async function setSession(
  id: string,
  input: { label: string; durationSec?: number }
): Promise<Committee> {
  return patch({ id, action: "set_session", ...input });
}

export async function clearSession(id: string): Promise<Committee> {
  return patch({ id, action: "clear_session" });
}
