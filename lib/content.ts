/**
 * Content store (videos + resources) for Phase 1.
 *
 * Like the auth layer, content lives in localStorage so admins can add and
 * remove items without a backend. Default content (including real, downloadable
 * resolution documents from the UN) is seeded on first run.
 *
 * ⚠️  Uploads here are metadata-only: an admin records a title and an optional
 * link. Actual file storage / upload is a Phase 2 (backend) task.
 */

export interface Resource {
  id: string;
  title: string;
  type: string;
  format: string;
  desc: string;
  /** Optional external link (e.g. a real PDF). Falls back to "#" in the UI. */
  url?: string;
  /** Seeded items can't be deleted by accident styling-wise, but admins may. */
  seeded?: boolean;
}

export interface Video {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  url?: string;
  seeded?: boolean;
}

const RESOURCES_KEY = "mun_resources";
const VIDEOS_KEY = "mun_videos";

/**
 * Real, publicly available resolution & procedure documents from the UN, plus
 * the platform's own templates and guides.
 */
const DEFAULT_RESOURCES: Resource[] = [
  {
    id: "udhr",
    title: "Universal Declaration of Human Rights (Res. 217 A)",
    type: "Resolution",
    format: "PDF",
    desc: "The landmark 1948 UN General Assembly resolution — a model for clear, principled drafting.",
    url: "https://www.un.org/sites/un2.un.org/files/2021/03/udhr.pdf",
    seeded: true,
  },
  {
    id: "un-charter",
    title: "Charter of the United Nations",
    type: "Reference",
    format: "Web",
    desc: "The founding treaty of the UN — essential context for every committee.",
    url: "https://www.un.org/en/about-us/un-charter/full-text",
    seeded: true,
  },
  {
    id: "res-70-1",
    title: "Transforming Our World: 2030 Agenda (Res. 70/1)",
    type: "Resolution",
    format: "PDF",
    desc: "The Sustainable Development Goals resolution — a study in operative-clause structure.",
    url: "https://documents.un.org/doc/undoc/gen/n15/291/89/pdf/n1529189.pdf",
    seeded: true,
  },
  {
    id: "ropga",
    title: "Rules of Procedure of the General Assembly",
    type: "Guide",
    format: "Web",
    desc: "The official rules that real GA sessions — and most MUN committees — are based on.",
    url: "https://www.un.org/en/ga/about/ropga/",
    seeded: true,
  },
  {
    id: "position-paper",
    title: "Position Paper Template",
    type: "Template",
    format: "DOCX",
    desc: "A ready-to-fill structure for your country's stance on each topic.",
    seeded: true,
  },
  {
    id: "resolution-guide",
    title: "Resolution Writing Guide",
    type: "Guide",
    format: "PDF",
    desc: "Preambulatory and operative clauses explained, with examples.",
    seeded: true,
  },
];

const DEFAULT_VIDEOS: Video[] = [
  { id: "v1", title: "Welcome to Model UN", category: "Getting Started", level: "Beginner", duration: "8:24", seeded: true },
  { id: "v2", title: "Rules of Procedure 101", category: "Procedure", level: "Beginner", duration: "12:05", seeded: true },
  { id: "v3", title: "Writing a Winning Position Paper", category: "Research", level: "Intermediate", duration: "15:38", seeded: true },
  { id: "v4", title: "Mastering the Moderated Caucus", category: "Debate", level: "Intermediate", duration: "10:52", seeded: true },
  { id: "v5", title: "Drafting Resolutions That Pass", category: "Writing", level: "Advanced", duration: "18:20", seeded: true },
  { id: "v6", title: "Surviving Your First Crisis Committee", category: "Crisis", level: "Advanced", duration: "14:47", seeded: true },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T[]): T[] {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function write<T>(key: string, items: T[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------------------------------- Resources --------------------------------- */

export function getResources(): Resource[] {
  return read<Resource>(RESOURCES_KEY, DEFAULT_RESOURCES);
}

export function addResource(input: {
  title: string;
  type?: string;
  format?: string;
  desc?: string;
  url?: string;
}): Resource[] {
  const resources = getResources();
  const resource: Resource = {
    id: makeId(),
    title: input.title.trim(),
    type: input.type?.trim() || "Resource",
    format: input.format?.trim() || (input.url ? "Link" : "File"),
    desc: input.desc?.trim() || "Uploaded by an administrator.",
    url: input.url?.trim() || undefined,
  };
  const next = [resource, ...resources];
  write(RESOURCES_KEY, next);
  return next;
}

export function deleteResource(id: string): Resource[] {
  const next = getResources().filter((r) => r.id !== id);
  write(RESOURCES_KEY, next);
  return next;
}

/* ----------------------------------- Videos ----------------------------------- */

export function getVideos(): Video[] {
  return read<Video>(VIDEOS_KEY, DEFAULT_VIDEOS);
}

export function addVideo(input: {
  title: string;
  category?: string;
  level?: Video["level"];
  duration?: string;
  url?: string;
}): Video[] {
  const videos = getVideos();
  const video: Video = {
    id: makeId(),
    title: input.title.trim(),
    category: input.category?.trim() || "General",
    level: input.level || "Beginner",
    duration: input.duration?.trim() || "—",
    url: input.url?.trim() || undefined,
  };
  const next = [video, ...videos];
  write(VIDEOS_KEY, next);
  return next;
}

export function deleteVideo(id: string): Video[] {
  const next = getVideos().filter((v) => v.id !== id);
  write(VIDEOS_KEY, next);
  return next;
}
