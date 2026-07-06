/** Client wrappers for document templates (/api/templates). */

export interface Template {
  id: string;
  name: string;
  description: string;
  html: string;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }
  return res;
}

export async function getTemplates(): Promise<Template[]> {
  const res = await api("/api/templates");
  return ((await res.json()) as { templates: Template[] }).templates;
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; html?: string }
): Promise<Template> {
  const res = await api("/api/templates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  return ((await res.json()) as { template: Template }).template;
}

export async function resetTemplate(id: string): Promise<Template> {
  const res = await api("/api/templates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reset: true }),
  });
  return ((await res.json()) as { template: Template }).template;
}
