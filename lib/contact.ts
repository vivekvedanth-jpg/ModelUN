/**
 * Contact / query store for Phase 1.
 *
 * Visitors (including people without an account) can send a question. With no
 * backend, delivery works two ways:
 *   1. The message is saved to localStorage so the Owner can read it in the
 *      Admin Dashboard "Inbox" on this device.
 *   2. buildMailto() opens the visitor's email app pre-addressed to the Owner,
 *      so the message actually reaches the inbox.
 *
 * The recipient address is kept here (not rendered anywhere in the UI). To
 * upgrade to true server-side delivery, swap buildMailto() for a POST to a form
 * backend (Formspree / Web3Forms) — see the README.
 */

/** Where queries are routed. Intentionally not displayed in the UI. */
export const CONTACT_RECIPIENT = "gusty_dioxin4o@icloud.com";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: number;
}

const KEY = "mun_contact_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getMessages(): ContactMessage[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as ContactMessage[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeMessages(list: ContactMessage[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export interface NewMessage {
  name: string;
  email: string;
  message: string;
}

/** Saves a message locally and returns the stored record. */
export function saveMessage(input: NewMessage): ContactMessage {
  const msg: ContactMessage = {
    id: makeId(),
    name: input.name.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
    createdAt: Date.now(),
  };
  writeMessages([msg, ...getMessages()]);
  return msg;
}

export function deleteMessage(id: string): ContactMessage[] {
  const next = getMessages().filter((m) => m.id !== id);
  writeMessages(next);
  return next;
}

/** Builds a mailto: link that routes the query to the (hidden) recipient. */
export function buildMailto(input: NewMessage): string {
  const subject = `MUN platform query from ${input.name.trim() || "a visitor"}`;
  const body = `From: ${input.name.trim()} <${input.email.trim()}>\n\n${input.message.trim()}`;
  return `mailto:${CONTACT_RECIPIENT}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
