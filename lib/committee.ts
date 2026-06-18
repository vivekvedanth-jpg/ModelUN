/**
 * Committee scoring store for Phase 1 (chairs).
 *
 * A "chair" account runs one or more committees. Each committee has its own
 * roster of delegates and a configurable set of scoring categories (columns)
 * such as GSL, Moderated Caucus, etc. The chair awards points per delegate per
 * category; a delegate's committee score is the sum across categories, and each
 * committee has its own standings (separate from the platform-wide rankings).
 *
 * The Owner can oversee (view/edit) every committee; a chair can only manage
 * their own. Persisted in localStorage; replace with a backend in Phase 2.
 */

import { isOwner, type User } from "./auth";

export interface ScoreColumn {
  id: string;
  label: string;
}

export interface CommitteeDelegate {
  id: string;
  name: string;
  portfolio?: string; // country / character represented
  scores: Record<string, number>; // columnId -> points
}

/** One entry in the committee's speaker list (GSL). */
export interface SpeakerEntry {
  id: string;
  name: string; // country or delegate name
  done: boolean;
}

export interface Committee {
  id: string;
  chair: string; // email of the chair (or owner) who owns this committee
  name: string;
  conference?: string;
  columns: ScoreColumn[];
  delegates: CommitteeDelegate[];
  speakers: SpeakerEntry[];
  currentSpeakerId?: string;
  published: boolean; // when true, delegates can see the scores/standings
  createdAt: number;
  updatedAt: number;
}

/** The default scoring categories every new committee starts with. */
export const DEFAULT_COLUMN_LABELS = [
  "GSL",
  "Mod Caucus",
  "Unmod Caucus",
  "Resolution",
  "Diplomacy",
];

const KEY = "mun_committees_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): Committee[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Committee[]) : [];
    // Backfill fields added after the first release so older saved committees
    // (which predate the speaker list / publish flag) still work.
    return list.map((c) => ({
      ...c,
      speakers: Array.isArray(c.speakers) ? c.speakers : [],
      published: !!c.published,
    }));
  } catch {
    return [];
  }
}

function writeAll(items: Committee[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

function byUpdatedDesc(a: Committee, b: Committee): number {
  return b.updatedAt - a.updatedAt;
}

function defaultColumns(): ScoreColumn[] {
  return DEFAULT_COLUMN_LABELS.map((label) => ({ id: makeId(), label }));
}

/** Every committee on the platform (Owner oversight). */
export function getAllCommittees(): Committee[] {
  return readAll().sort(byUpdatedDesc);
}

/** Committees owned by a specific chair. */
export function getCommittees(email: string): Committee[] {
  const lower = email.toLowerCase();
  return readAll()
    .filter((c) => c.chair.toLowerCase() === lower)
    .sort(byUpdatedDesc);
}

/** What the signed-in user should see: chairs see their own, the Owner sees all. */
export function getCommitteesForUser(user: User | null): Committee[] {
  if (!user) return [];
  return isOwner(user) ? getAllCommittees() : getCommittees(user.email);
}

export function getCommittee(id: string): Committee | undefined {
  return readAll().find((c) => c.id === id);
}

/** The total points a delegate has across the committee's current categories. */
export function totalFor(committee: Committee, d: CommitteeDelegate): number {
  return committee.columns.reduce(
    (sum, col) => sum + (d.scores[col.id] ?? 0),
    0
  );
}

/** Creates a committee owned by the current chair/owner. */
export function createCommittee(
  user: User | null,
  name = "New committee"
): Committee {
  if (!user) throw new Error("You must be signed in.");
  if (user.role !== "chair" && !isOwner(user)) {
    throw new Error("Only chairs can create committees.");
  }
  const now = Date.now();
  const committee: Committee = {
    id: makeId(),
    chair: user.email,
    name: name.trim() || "New committee",
    conference: "",
    columns: defaultColumns(),
    delegates: [],
    speakers: [],
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([committee, ...readAll()]);
  return committee;
}

/**
 * Finds a committee the user is allowed to manage, applies `fn` to it, then
 * persists. The Owner may manage any committee; a chair only their own.
 */
function mutate(
  user: User | null,
  id: string,
  fn: (c: Committee) => void
): Committee {
  if (!user) throw new Error("You must be signed in.");
  const all = readAll();
  const committee = all.find((c) => c.id === id);
  if (!committee) throw new Error("That committee no longer exists.");
  if (!isOwner(user) && committee.chair.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("You can only manage your own committee.");
  }
  fn(committee);
  committee.updatedAt = Date.now();
  try {
    writeAll(all);
  } catch {
    throw new Error("Couldn't save — your browser storage may be full.");
  }
  return committee;
}

export function renameCommittee(
  user: User | null,
  id: string,
  patch: { name?: string; conference?: string }
): Committee {
  return mutate(user, id, (c) => {
    if (patch.name !== undefined) c.name = patch.name;
    if (patch.conference !== undefined) c.conference = patch.conference;
  });
}

/** Deletes a committee and returns the remaining list for the user. */
export function deleteCommittee(user: User | null, id: string): Committee[] {
  if (!user) throw new Error("You must be signed in.");
  const all = readAll();
  const committee = all.find((c) => c.id === id);
  if (committee && !isOwner(user) && committee.chair.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("You can only delete your own committee.");
  }
  writeAll(all.filter((c) => c.id !== id));
  return getCommitteesForUser(user);
}

export function addColumn(
  user: User | null,
  id: string,
  label = "New"
): Committee {
  return mutate(user, id, (c) => {
    c.columns.push({ id: makeId(), label: label.trim() || "New" });
  });
}

export function renameColumn(
  user: User | null,
  id: string,
  columnId: string,
  label: string
): Committee {
  return mutate(user, id, (c) => {
    const col = c.columns.find((x) => x.id === columnId);
    if (col) col.label = label;
  });
}

export function removeColumn(
  user: User | null,
  id: string,
  columnId: string
): Committee {
  return mutate(user, id, (c) => {
    c.columns = c.columns.filter((x) => x.id !== columnId);
    // Tidy up: drop the removed category's scores from every delegate.
    for (const d of c.delegates) delete d.scores[columnId];
  });
}

export function addDelegate(
  user: User | null,
  id: string,
  input: { name: string; portfolio?: string }
): Committee {
  return mutate(user, id, (c) => {
    const name = input.name.trim();
    if (!name) throw new Error("Please enter the delegate's name.");
    c.delegates.push({
      id: makeId(),
      name,
      portfolio: input.portfolio?.trim() || undefined,
      scores: {},
    });
  });
}

export function removeDelegate(
  user: User | null,
  id: string,
  delegateId: string
): Committee {
  return mutate(user, id, (c) => {
    c.delegates = c.delegates.filter((d) => d.id !== delegateId);
  });
}

/** Sets (or clears, when value is null/NaN) one delegate's score in a category. */
export function setScore(
  user: User | null,
  id: string,
  delegateId: string,
  columnId: string,
  value: number | null
): Committee {
  return mutate(user, id, (c) => {
    const d = c.delegates.find((x) => x.id === delegateId);
    if (!d) return;
    if (value === null || !Number.isFinite(value)) {
      delete d.scores[columnId];
    } else {
      d.scores[columnId] = value;
    }
  });
}

/* --------------------------------- Speakers --------------------------------- */

export function addSpeaker(
  user: User | null,
  id: string,
  name: string
): Committee {
  return mutate(user, id, (c) => {
    const n = name.trim();
    if (!n) throw new Error("Enter a country or delegate name.");
    c.speakers.push({ id: makeId(), name: n, done: false });
  });
}

export function removeSpeaker(
  user: User | null,
  id: string,
  speakerId: string
): Committee {
  return mutate(user, id, (c) => {
    c.speakers = c.speakers.filter((s) => s.id !== speakerId);
    if (c.currentSpeakerId === speakerId) c.currentSpeakerId = undefined;
  });
}

export function moveSpeaker(
  user: User | null,
  id: string,
  speakerId: string,
  dir: -1 | 1
): Committee {
  return mutate(user, id, (c) => {
    const i = c.speakers.findIndex((s) => s.id === speakerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.speakers.length) return;
    [c.speakers[i], c.speakers[j]] = [c.speakers[j], c.speakers[i]];
  });
}

/** Marks one speaker as the one currently speaking (or clears it with null). */
export function setCurrentSpeaker(
  user: User | null,
  id: string,
  speakerId: string | null
): Committee {
  return mutate(user, id, (c) => {
    c.currentSpeakerId = speakerId ?? undefined;
  });
}

export function toggleSpeakerDone(
  user: User | null,
  id: string,
  speakerId: string
): Committee {
  return mutate(user, id, (c) => {
    const s = c.speakers.find((x) => x.id === speakerId);
    if (s) s.done = !s.done;
  });
}

export function clearSpeakers(user: User | null, id: string): Committee {
  return mutate(user, id, (c) => {
    c.speakers = [];
    c.currentSpeakerId = undefined;
  });
}

/* --------------------------------- Publish ---------------------------------- */

/** Releases (or hides) the committee's scores to its delegates. */
export function setPublished(
  user: User | null,
  id: string,
  published: boolean
): Committee {
  return mutate(user, id, (c) => {
    c.published = published;
  });
}
