export const PLACEMENTS = [
  "Best Delegate",
  "Outstanding Delegate",
  "Honorable Mention",
  "Special Mention",
  "Verbal Mention",
  "Participant",
  "Other / None",
] as const;

export interface MunExperience {
  id: string;
  owner: string;
  conference: string;
  date: string;
  committee: string;
  portfolio: string;
  placement: string;
  notes?: string;
  scorecardName?: string;
  scorecardDataUrl?: string;
  createdAt: number;
}

export const MAX_SCORECARD_BYTES = 1.5 * 1024 * 1024;

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getExperiences(email: string): Promise<MunExperience[]> {
  const res = await api(`/api/experiences?owner=${encodeURIComponent(email)}`);
  return ((await res.json()) as { experiences: MunExperience[] }).experiences;
}

export async function getAllExperiences(): Promise<MunExperience[]> {
  const res = await api("/api/experiences");
  return ((await res.json()) as { experiences: MunExperience[] }).experiences;
}

export interface NewExperience {
  conference: string;
  date: string;
  committee: string;
  portfolio: string;
  placement: string;
  notes?: string;
  scorecardName?: string;
  scorecardDataUrl?: string;
}

export async function addExperience(input: NewExperience): Promise<MunExperience> {
  const res = await api("/api/experiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return ((await res.json()) as { experience: MunExperience }).experience;
}

/**
 * Patch fields on an existing experience. Any field left out is unchanged;
 * `scorecardDataUrl: null` removes the attached scorecard.
 */
export interface ExperiencePatch {
  conference?: string;
  date?: string;
  committee?: string;
  portfolio?: string;
  placement?: string;
  notes?: string;
  scorecardName?: string | null;
  scorecardDataUrl?: string | null;
}

export async function updateExperience(
  id: string,
  patch: ExperiencePatch
): Promise<MunExperience> {
  const res = await api("/api/experiences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  return ((await res.json()) as { experience: MunExperience }).experience;
}

export async function deleteExperience(id: string): Promise<void> {
  await api(`/api/experiences?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Canonical placements that count as podium "awards". */
export const AWARD_PLACEMENTS = [
  "Best Delegate",
  "Outstanding Delegate",
  "Honorable Mention",
] as const;

/** True when a placement string is one of the three podium awards. */
export function isAward(placement: string): boolean {
  return (AWARD_PLACEMENTS as readonly string[]).includes(placement);
}

/** Sort experiences newest-first (date desc, then createdAt desc) like the server. */
export function sortExperiences(list: MunExperience[]): MunExperience[] {
  return [...list].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt
  );
}
