export const CONTACT_RECIPIENT = "gusty_dioxin4o@icloud.com";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: number;
}

export interface NewMessage { name: string; email: string; message: string; }

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getMessages(): Promise<ContactMessage[]> {
  const res = await api("/api/messages");
  return ((await res.json()) as { messages: ContactMessage[] }).messages;
}

export async function saveMessage(input: NewMessage): Promise<void> {
  await api("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMessage(id: string): Promise<void> {
  await api(`/api/messages?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Opens the visitor's mail app as a fallback delivery mechanism. */
export function buildMailto(input: NewMessage): string {
  const subject = `MUN platform query from ${input.name.trim() || "a visitor"}`;
  const body = `From: ${input.name.trim()} <${input.email.trim()}>\n\n${input.message.trim()}`;
  return `mailto:${CONTACT_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
