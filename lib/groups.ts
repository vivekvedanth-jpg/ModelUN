/**
 * Groups store for Phase 1 (e.g. a MUN club, school, or university).
 *
 * The Owner creates named groups and assigns admins/delegates to them (the
 * assignment itself lives on each account in lib/auth as `groupId`). A
 * group-scoped admin can only see the profiles of accounts in their group;
 * an admin assigned to ALL_GROUPS — and the Owner — can see everyone.
 *
 * Persisted in localStorage; replace with a backend in Phase 2.
 */

import { isOwner, type User } from "./auth";

export interface Group {
  id: string;
  name: string;
  createdAt: number;
}

const KEY = "mun_groups_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): Group[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Group[]) : [];
  } catch {
    return [];
  }
}

function writeAll(groups: Group[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(groups));
}

/** All groups, alphabetical. */
export function getGroups(): Group[] {
  return readAll().sort((a, b) => a.name.localeCompare(b.name));
}

export function getGroup(id: string | undefined): Group | undefined {
  if (!id) return undefined;
  return readAll().find((g) => g.id === id);
}

/** The display name for a group id (handles unknown/empty ids gracefully). */
export function groupName(id: string | undefined): string {
  return getGroup(id)?.name ?? "";
}

/** Owner-only: create a new group. */
export function createGroup(actor: User | null, name: string): Group {
  if (!isOwner(actor)) throw new Error("Only the Owner can create groups.");
  const clean = name.trim();
  if (!clean) throw new Error("Please enter a group name.");
  const all = readAll();
  if (all.some((g) => g.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error("A group with that name already exists.");
  }
  const group: Group = { id: makeId(), name: clean, createdAt: Date.now() };
  writeAll([...all, group]);
  return group;
}

/** Owner-only: rename a group. */
export function renameGroup(
  actor: User | null,
  id: string,
  name: string
): Group {
  if (!isOwner(actor)) throw new Error("Only the Owner can rename groups.");
  const clean = name.trim();
  if (!clean) throw new Error("Please enter a group name.");
  const all = readAll();
  const group = all.find((g) => g.id === id);
  if (!group) throw new Error("That group no longer exists.");
  group.name = clean;
  writeAll(all);
  return group;
}

/** Owner-only: delete a group. Callers should also clear it from accounts. */
export function deleteGroup(actor: User | null, id: string): Group[] {
  if (!isOwner(actor)) throw new Error("Only the Owner can delete groups.");
  writeAll(readAll().filter((g) => g.id !== id));
  return getGroups();
}
