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

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getVisibleQuestions(): Promise<Question[]> {
  const res = await api("/api/qa");
  return ((await res.json()) as { questions: Question[] }).questions;
}

export async function addQuestion(text: string, visibility: Visibility): Promise<Question> {
  const res = await api("/api/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, visibility }),
  });
  return ((await res.json()) as { question: Question }).question;
}

export async function answerQuestion(id: string, answer: string): Promise<void> {
  await api("/api/qa", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, answer }),
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  await api(`/api/qa?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
