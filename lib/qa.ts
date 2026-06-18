/**
 * Q&A store for Phase 1.
 *
 * Signed-in delegates can post questions and choose whether each one is:
 *   - "public"  — visible to everyone signed in, or
 *   - "private" — visible only to the author and to admins/owner.
 *
 * Admins (and the owner) can answer any question and delete any question.
 * Authors can delete their own questions.
 *
 * Persisted in localStorage; replace with a backend in Phase 2.
 */

import { isAdmin, type User } from "./auth";

export type Visibility = "public" | "private";

export interface Question {
  id: string;
  author: string;
  text: string;
  visibility: Visibility;
  createdAt: number;
  answer?: string;
  answeredBy?: string;
  answeredAt?: number;
}

const QUESTIONS_KEY = "mun_questions_v2";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): Question[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUESTIONS_KEY);
    return raw ? (JSON.parse(raw) as Question[]) : [];
  } catch {
    return [];
  }
}

function writeAll(questions: Question[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** True if the given user is allowed to see the given question. */
function canView(user: User | null, q: Question): boolean {
  if (q.visibility === "public") return true;
  if (!user) return false;
  return (
    isAdmin(user.role) ||
    q.author.toLowerCase() === user.email.toLowerCase()
  );
}

/** Returns the questions the current user is allowed to see, newest first. */
export function getVisibleQuestions(user: User | null): Question[] {
  return readAll()
    .filter((q) => canView(user, q))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Posts a new question as the current user. */
export function addQuestion(
  user: User | null,
  text: string,
  visibility: Visibility
): Question[] {
  if (!user) {
    throw new Error("You must be signed in to ask a question.");
  }
  const clean = text.trim();
  if (clean.length < 3) {
    throw new Error("Your question is a little too short.");
  }

  const question: Question = {
    id: makeId(),
    author: user.email,
    text: clean,
    visibility,
    createdAt: Date.now(),
  };
  writeAll([question, ...readAll()]);
  return getVisibleQuestions(user);
}

/** Admin/owner answers a question. */
export function answerQuestion(
  actor: User | null,
  id: string,
  answer: string
): Question[] {
  if (!actor || !isAdmin(actor.role)) {
    throw new Error("Only admins can answer questions.");
  }
  const clean = answer.trim();
  if (!clean) {
    throw new Error("Please write an answer first.");
  }

  const questions = readAll();
  const q = questions.find((item) => item.id === id);
  if (!q) throw new Error("That question no longer exists.");

  q.answer = clean;
  q.answeredBy = actor.email;
  q.answeredAt = Date.now();
  writeAll(questions);
  return getVisibleQuestions(actor);
}

/**
 * Reassigns authored questions (and answers) from one email to another, used
 * when a user changes their email so their Q&A history follows them.
 */
export function reassignAuthor(oldEmail: string, newEmail: string): void {
  const lower = oldEmail.toLowerCase();
  const questions = readAll();
  let changed = false;
  for (const q of questions) {
    if (q.author.toLowerCase() === lower) {
      q.author = newEmail;
      changed = true;
    }
    if (q.answeredBy && q.answeredBy.toLowerCase() === lower) {
      q.answeredBy = newEmail;
      changed = true;
    }
  }
  if (changed) writeAll(questions);
}

/** Deletes a question. Allowed for the author or any admin/owner. */
export function deleteQuestion(actor: User | null, id: string): Question[] {
  const questions = readAll();
  const q = questions.find((item) => item.id === id);
  if (!q) return getVisibleQuestions(actor);

  const isAuthor =
    !!actor && q.author.toLowerCase() === actor.email.toLowerCase();
  if (!isAuthor && !(actor && isAdmin(actor.role))) {
    throw new Error("You don't have permission to delete this question.");
  }

  writeAll(questions.filter((item) => item.id !== id));
  return getVisibleQuestions(actor);
}
