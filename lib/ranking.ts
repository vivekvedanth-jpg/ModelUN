import type { AccountDetail } from "./auth";
import { PLACEMENTS, type MunExperience } from "./experience";

export const DEFAULT_POINTS: Record<string, number> = {
  "Best Delegate": 20,
  "Outstanding Delegate": 15,
  "Honorable Mention": 12,
  "Special Mention": 10,
  "Verbal Mention": 8,
  "Participant": 5,
  "Other / None": 2,
};

export interface LeaderRow {
  email: string;
  name: string;
  role: AccountDetail["role"];
  score: number;
  count: number;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getRankingSettings(): Promise<{ points: Record<string, number>; manualOrder: string[] }> {
  const res = await api("/api/ranking");
  return res.json() as Promise<{ points: Record<string, number>; manualOrder: string[] }>;
}

export async function setPointsMap(map: Record<string, number>): Promise<void> {
  await api("/api/ranking", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_points", value: map }),
  });
}

export async function resetPointsMap(): Promise<Record<string, number>> {
  const res = await api("/api/ranking", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset_points" }),
  });
  return ((await res.json()) as { points: Record<string, number> }).points;
}

export async function setManualOrder(emails: string[]): Promise<void> {
  await api("/api/ranking", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_order", value: emails }),
  });
}

export async function clearManualOrder(): Promise<void> {
  await api("/api/ranking", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "clear_order" }),
  });
}

/** Pure: computes score for a set of experiences. */
export function scoreForExperiences(
  experiences: MunExperience[],
  points: Record<string, number>
): number {
  return experiences.reduce((sum, e) => sum + (points[e.placement] ?? 0), 0);
}

/** Pure: builds the leaderboard from fetched data. */
export function computeLeaderboard(
  accounts: AccountDetail[],
  experiences: MunExperience[],
  points: Record<string, number>,
  manualOrder: string[] = []
): LeaderRow[] {
  const byOwner = new Map<string, MunExperience[]>();
  for (const e of experiences) {
    const key = e.owner.toLowerCase();
    const list = byOwner.get(key) ?? [];
    list.push(e);
    byOwner.set(key, list);
  }

  function nameFor(a: AccountDetail): string {
    return a.profile.fullName?.trim() || a.email.split("@")[0];
  }

  const rows: LeaderRow[] = accounts
    .map((a) => {
      const list = byOwner.get(a.email.toLowerCase()) ?? [];
      return {
        email: a.email,
        name: nameFor(a),
        role: a.role,
        score: scoreForExperiences(list, points),
        count: list.length,
      };
    })
    .filter((r) => r.count > 0);

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (manualOrder.length === 0) return rows;

  const index = new Map(manualOrder.map((email, i) => [email.toLowerCase(), i]));
  return [...rows].sort((a, b) => {
    const ai = index.has(a.email.toLowerCase())
      ? (index.get(a.email.toLowerCase()) as number)
      : Number.MAX_SAFE_INTEGER;
    const bi = index.has(b.email.toLowerCase())
      ? (index.get(b.email.toLowerCase()) as number)
      : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return b.score - a.score || a.name.localeCompare(b.name);
  });
}

// Keep PLACEMENTS re-export so existing imports still work.
export { PLACEMENTS };
