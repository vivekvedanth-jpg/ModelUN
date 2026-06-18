/**
 * Resolution document store for Phase 1.
 *
 * Each delegate gets their own word-processor-style documents (title + rich
 * HTML body) for drafting resolutions. Content auto-saves to localStorage as
 * they type. Replace with a backend in Phase 2.
 */

import type { User } from "./auth";

export interface ResolutionDoc {
  id: string;
  owner: string; // the delegate's email
  title: string;
  html: string; // rich-text body
  createdAt: number;
  updatedAt: number;
}

const KEY = "mun_documents_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): ResolutionDoc[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResolutionDoc[]) : [];
  } catch {
    return [];
  }
}

function writeAll(docs: ResolutionDoc[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(docs));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** A delegate's documents, most recently edited first. */
export function getDocuments(email: string): ResolutionDoc[] {
  const lower = email.toLowerCase();
  return readAll()
    .filter((d) => d.owner.toLowerCase() === lower)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDocument(id: string): ResolutionDoc | undefined {
  return readAll().find((d) => d.id === id);
}

/** Creates a new (empty) document for the signed-in delegate. */
export function createDocument(
  user: User | null,
  title = "Untitled resolution"
): ResolutionDoc {
  if (!user) throw new Error("You must be signed in.");
  const now = Date.now();
  const doc: ResolutionDoc = {
    id: makeId(),
    owner: user.email,
    title: title.trim() || "Untitled resolution",
    html: "",
    createdAt: now,
    updatedAt: now,
  };
  writeAll([doc, ...readAll()]);
  return doc;
}

/** Saves changes to one of the signed-in delegate's documents. */
export function updateDocument(
  user: User | null,
  id: string,
  patch: { title?: string; html?: string }
): ResolutionDoc {
  if (!user) throw new Error("You must be signed in.");
  const docs = readAll();
  const doc = docs.find((d) => d.id === id);
  if (!doc) throw new Error("That document no longer exists.");
  if (doc.owner.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("You can only edit your own documents.");
  }

  if (patch.title !== undefined) doc.title = patch.title.trim() || "Untitled resolution";
  if (patch.html !== undefined) doc.html = patch.html;
  doc.updatedAt = Date.now();

  try {
    writeAll(docs);
  } catch {
    throw new Error("Couldn't save — your browser storage may be full.");
  }
  return doc;
}

export function deleteDocument(user: User | null, id: string): ResolutionDoc[] {
  if (!user) throw new Error("You must be signed in.");
  const docs = readAll();
  const doc = docs.find((d) => d.id === id);
  if (doc && doc.owner.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("You can only delete your own documents.");
  }
  writeAll(docs.filter((d) => d.id !== id));
  return getDocuments(user.email);
}

/** Moves a delegate's documents to a new email (used on email change). */
export function reassignDocumentOwner(oldEmail: string, newEmail: string): void {
  const lower = oldEmail.toLowerCase();
  const docs = readAll();
  let changed = false;
  for (const d of docs) {
    if (d.owner.toLowerCase() === lower) {
      d.owner = newEmail;
      changed = true;
    }
  }
  if (changed) writeAll(docs);
}
