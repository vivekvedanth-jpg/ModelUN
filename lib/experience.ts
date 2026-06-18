/**
 * MUN experience store for Phase 1.
 *
 * Each delegate can record the conferences they've attended — the committee,
 * their portfolio/country, the award/placement they earned, and an optional
 * scorecard file. Admins (and the owner) can view every delegate's history.
 *
 * Persisted in localStorage; replace with a backend in Phase 2. Scorecard files
 * are stored inline as data URLs, so only small files are accepted (see
 * MAX_SCORECARD_BYTES).
 */

import { isAdmin, type User } from "./auth";

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
  owner: string; // the delegate's email
  conference: string;
  date: string; // yyyy-mm-dd from a date input
  committee: string; // e.g. "UNSC", "DISEC", "Crisis"
  portfolio: string; // country or character represented
  placement: string;
  notes?: string;
  scorecardName?: string;
  scorecardDataUrl?: string;
  createdAt: number;
}

/** Max scorecard size we'll inline into localStorage (~1.5 MB). */
export const MAX_SCORECARD_BYTES = 1.5 * 1024 * 1024;

const KEY = "mun_experiences_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): MunExperience[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MunExperience[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: MunExperience[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function byDateDesc(a: MunExperience, b: MunExperience): number {
  // Dates are yyyy-mm-dd strings, so a plain comparison sorts chronologically.
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.createdAt - a.createdAt;
}

/** All experiences for one delegate, newest first. */
export function getExperiences(email: string): MunExperience[] {
  const lower = email.toLowerCase();
  return readAll()
    .filter((e) => e.owner.toLowerCase() === lower)
    .sort(byDateDesc);
}

/** Every experience on the platform (admin view). */
export function getAllExperiences(): MunExperience[] {
  return readAll().sort(byDateDesc);
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

/** Adds an experience for the signed-in delegate. */
export function addExperience(
  user: User | null,
  input: NewExperience
): MunExperience[] {
  if (!user) throw new Error("You must be signed in.");
  if (!input.conference.trim()) throw new Error("Please enter the conference name.");
  if (!input.date) throw new Error("Please choose the conference date.");

  const experience: MunExperience = {
    id: makeId(),
    owner: user.email,
    conference: input.conference.trim(),
    date: input.date,
    committee: input.committee.trim() || "—",
    portfolio: input.portfolio.trim() || "—",
    placement: input.placement || "Other / None",
    notes: input.notes?.trim() || undefined,
    scorecardName: input.scorecardName,
    scorecardDataUrl: input.scorecardDataUrl,
    createdAt: Date.now(),
  };

  try {
    writeAll([experience, ...readAll()]);
  } catch {
    // Most likely the localStorage quota was exceeded by an inlined scorecard.
    throw new Error(
      "Couldn't save — the scorecard file may be too large. Try a smaller image or skip the file."
    );
  }
  return getExperiences(user.email);
}

/** Deletes an experience. Allowed for the record's owner or any admin/owner. */
export function deleteExperience(
  actor: User | null,
  id: string
): MunExperience[] {
  const all = readAll();
  const target = all.find((e) => e.id === id);
  if (!target) return actor ? getExperiences(actor.email) : [];

  const isOwnerOfRecord =
    !!actor && target.owner.toLowerCase() === actor.email.toLowerCase();
  if (!isOwnerOfRecord && !(actor && isAdmin(actor.role))) {
    throw new Error("You don't have permission to delete this entry.");
  }

  writeAll(all.filter((e) => e.id !== id));
  return actor ? getExperiences(actor.email) : [];
}

/**
 * Reassigns every experience from one email to another. Called when a delegate
 * changes their email so their history follows them.
 */
export function reassignExperienceOwner(
  oldEmail: string,
  newEmail: string
): void {
  const lower = oldEmail.toLowerCase();
  const all = readAll();
  let changed = false;
  for (const e of all) {
    if (e.owner.toLowerCase() === lower) {
      e.owner = newEmail;
      changed = true;
    }
  }
  if (changed) writeAll(all);
}
