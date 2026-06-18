/**
 * MUN Assistant model settings (Phase 1).
 *
 * Admins can switch which Gemini model powers the assistant (e.g. Flash vs.
 * Flash Lite). The choice is stored in localStorage and sent with each chat
 * request; the server route validates it against this allowlist and falls back
 * to the env default (GEMINI_MODEL) otherwise. The API key always stays
 * server-side — only the model name travels in the request body.
 */

export interface AssistantModel {
  id: string;
  label: string;
  blurb: string;
}

/** The models an admin can choose between. */
export const ASSISTANT_MODELS: AssistantModel[] = [
  {
    id: "gemini-3.5-flash",
    label: "Flash",
    blurb: "Most capable — best answers, a little slower.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Flash Lite",
    blurb: "Faster & lighter — quicker replies for simpler asks.",
  },
];

export const DEFAULT_ASSISTANT_MODEL = ASSISTANT_MODELS[0].id;

/** Valid model ids (used for server-side validation). */
export const ASSISTANT_MODEL_IDS = ASSISTANT_MODELS.map((m) => m.id);

const KEY = "mun_assistant_model_v1";

export function isValidAssistantModel(id: string | undefined | null): boolean {
  return !!id && ASSISTANT_MODEL_IDS.includes(id);
}

/** The friendly label for a model id (falls back to the raw id). */
export function modelLabel(id: string): string {
  return ASSISTANT_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** The currently selected model (defaults to Flash). Client-side only. */
export function getAssistantModel(): string {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_MODEL;
  try {
    const v = window.localStorage.getItem(KEY);
    return isValidAssistantModel(v) ? (v as string) : DEFAULT_ASSISTANT_MODEL;
  } catch {
    return DEFAULT_ASSISTANT_MODEL;
  }
}

/** Persists the admin's model choice. */
export function setAssistantModel(id: string): void {
  if (typeof window === "undefined") return;
  if (!isValidAssistantModel(id)) return;
  window.localStorage.setItem(KEY, id);
}
