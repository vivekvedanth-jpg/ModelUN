/** Client wrappers for document templates (/api/templates). */

export interface Template {
  id: string;
  name: string;
  description: string;
  html: string;
  /** True for admin-created templates (deletable); false/undefined for the built-in ones. */
  custom?: boolean;
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

export async function createTemplate(input: {
  name: string;
  description?: string;
  html?: string;
}): Promise<Template> {
  const res = await api("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return ((await res.json()) as { template: Template }).template;
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; description?: string; html?: string }
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

export async function deleteTemplate(id: string): Promise<void> {
  await api(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
