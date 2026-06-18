/**
 * Delegate ranking for Phase 1.
 *
 * Each placement/award is worth points (configurable by admins). A delegate's
 * score is the sum of points across every conference they've logged. Admins can
 * also manually reorder the leaderboard; that order is persisted and takes
 * precedence over the score order until reset.
 *
 * Persisted in localStorage; replace with a backend in Phase 2.
 */

import type { AccountDetail } from "./auth";
import { PLACEMENTS, type MunExperience } from "./experience";

/** Default points per placement (admins can change these). */
export const DEFAULT_POINTS: Record<string, number> = {
  "Best Delegate": 20,
  "Outstanding Delegate": 15,
  "Honorable Mention": 12,
  "Special Mention": 10,
  "Verbal Mention": 8,
  "Participant": 5,
  "Other / None": 2,
};

const POINTS_KEY = "mun_ranking_points_v1";
const ORDER_KEY = "mun_ranking_order_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Current points map (defaults merged with any admin overrides). */
export function getPointsMap(): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const p of PLACEMENTS) merged[p] = DEFAULT_POINTS[p] ?? 0;
  if (!isBrowser()) return merged;
  try {
    const raw = window.localStorage.getItem(POINTS_KEY);
    if (raw) Object.assign(merged, JSON.parse(raw) as Record<string, number>);
  } catch {
    /* ignore */
  }
  return merged;
}

export function setPointsMap(map: Record<string, number>): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(POINTS_KEY, JSON.stringify(map));
}

export function resetPointsMap(): Record<string, number> {
  if (isBrowser()) window.localStorage.removeItem(POINTS_KEY);
  return getPointsMap();
}

export function getManualOrder(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setManualOrder(emails: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(emails));
}

export function clearManualOrder(): void {
  if (isBrowser()) window.localStorage.removeItem(ORDER_KEY);
}

export interface LeaderRow {
  email: string;
  name: string;
  role: AccountDetail["role"];
  score: number;
  count: number; // number of conferences
}

function nameFor(account: AccountDetail): string {
  return account.profile.fullName?.trim() || account.email.split("@")[0];
}

/** Sum of points a single set of experiences is worth. */
export function scoreForExperiences(
  experiences: MunExperience[],
  points: Record<string, number>
): number {
  return experiences.reduce((sum, e) => sum + (points[e.placement] ?? 0), 0);
}

/**
 * Builds the leaderboard. Only delegates who have logged at least one
 * conference are included. Sorted by score (desc); if a manual order is set,
 * those entries lead in that order and the rest follow by score.
 */
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
