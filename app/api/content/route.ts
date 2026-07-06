import { type NextRequest, NextResponse } from "next/server";
import {
  resourcesCol, videosCol,
  type ResourceDoc, type VideoDoc,
} from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const TITLE_MAX = 140;
const DESC_MAX = 500;

const DEFAULT_RESOURCES: ResourceDoc[] = [
  { id: "udhr", title: "Universal Declaration of Human Rights (Res. 217 A)", type: "Resolution", format: "PDF", desc: "The landmark 1948 UN General Assembly resolution — a model for clear, principled drafting.", url: "https://www.un.org/sites/un2.un.org/files/2021/03/udhr.pdf", seeded: true },
  { id: "un-charter", title: "Charter of the United Nations", type: "Reference", format: "Web", desc: "The founding treaty of the UN — essential context for every committee.", url: "https://www.un.org/en/about-us/un-charter/full-text", seeded: true },
  { id: "res-70-1", title: "Transforming Our World: 2030 Agenda (Res. 70/1)", type: "Resolution", format: "PDF", desc: "The Sustainable Development Goals resolution — a study in operative-clause structure.", url: "https://documents.un.org/doc/undoc/gen/n15/291/89/pdf/n1529189.pdf", seeded: true },
  { id: "ropga", title: "Rules of Procedure of the General Assembly", type: "Guide", format: "Web", desc: "The official rules that real GA sessions — and most MUN committees — are based on.", url: "https://www.un.org/en/ga/about/ropga/", seeded: true },
  { id: "position-paper", title: "Position Paper Template", type: "Template", format: "DOCX", desc: "A ready-to-fill structure for your country's stance on each topic.", seeded: true },
  { id: "resolution-guide", title: "Resolution Writing Guide", type: "Guide", format: "PDF", desc: "Preambulatory and operative clauses explained, with examples.", seeded: true },
];

const DEFAULT_VIDEOS: VideoDoc[] = [
  { id: "v1", title: "Welcome to Model UN", category: "Getting Started", level: "Beginner", duration: "8:24", seeded: true },
  { id: "v2", title: "Rules of Procedure 101", category: "Procedure", level: "Beginner", duration: "12:05", seeded: true },
  { id: "v3", title: "Writing a Winning Position Paper", category: "Research", level: "Intermediate", duration: "15:38", seeded: true },
  { id: "v4", title: "Mastering the Moderated Caucus", category: "Debate", level: "Intermediate", duration: "10:52", seeded: true },
  { id: "v5", title: "Drafting Resolutions That Pass", category: "Writing", level: "Advanced", duration: "18:20", seeded: true },
  { id: "v6", title: "Surviving Your First Crisis Committee", category: "Crisis", level: "Advanced", duration: "14:47", seeded: true },
];

/** Trimmed string for string input; undefined for blank or non-string values. */
function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.trim() || undefined;
}

function isKind(v: unknown): v is "video" | "resource" {
  return v === "video" || v === "resource";
}

/** Strips Mongo's _id so responses match the client types in lib/content.ts. */
function toResource(d: ResourceDoc): ResourceDoc {
  return { id: d.id, title: d.title, type: d.type, format: d.format, desc: d.desc, url: d.url, seeded: d.seeded };
}

function toVideo(d: VideoDoc): VideoDoc {
  return { id: d.id, title: d.title, category: d.category, level: d.level, duration: d.duration, url: d.url, seeded: d.seeded };
}

/** GET ?kind=resource|video — any signed-in user. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const kind = req.nextUrl.searchParams.get("kind") ?? "resource";

  if (kind === "video") {
    const col = await videosCol();
    let docs = await col.find({}).toArray();
    if (docs.length === 0) {
      // Per-doc upserts keyed on id: concurrent first requests can't double-seed.
      for (const doc of DEFAULT_VIDEOS) {
        await col.updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true });
      }
      docs = await col.find({}).toArray();
    }
    return NextResponse.json({ videos: docs.map(toVideo) });
  }

  const col = await resourcesCol();
  let docs = await col.find({}).toArray();
  if (docs.length === 0) {
    for (const doc of DEFAULT_RESOURCES) {
      await col.updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true });
    }
    docs = await col.find({}).toArray();
  }
  return NextResponse.json({ resources: docs.map(toResource) });
}

/** POST — admin publishes a new resource or video. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const kind = body.kind;
  if (!isKind(kind)) return fail("Unknown content kind.");

  const title = str(body.title);
  if (!title) return fail("Title is required.");
  if (title.length > TITLE_MAX) return fail(`Titles are capped at ${TITLE_MAX} characters.`);

  // Trim first, then validate — "  https://x " passes, "ftp://x" doesn't.
  const url = str(body.url);
  if (url && !/^https?:\/\//.test(url)) {
    return fail("Links must start with http:// or https://.");
  }

  const desc = str(body.desc);
  if (desc && desc.length > DESC_MAX) return fail(`Descriptions are capped at ${DESC_MAX} characters.`);

  if (kind === "video") {
    const level = body.level;
    const doc: VideoDoc = {
      id: makeId(),
      title,
      category: str(body.category) ?? "General",
      level: level === "Intermediate" || level === "Advanced" ? level : "Beginner",
      duration: str(body.duration) ?? "—",
      url,
    };
    await (await videosCol()).insertOne(doc);
    return NextResponse.json({ video: doc }, { status: 201 });
  }

  const doc: ResourceDoc = {
    id: makeId(),
    title,
    type: str(body.type) ?? "Resource",
    format: str(body.format) ?? (url ? "Link" : "File"),
    desc: desc ?? "Uploaded by an administrator.",
    url,
  };
  await (await resourcesCol()).insertOne(doc);
  return NextResponse.json({ resource: doc }, { status: 201 });
}

/** DELETE ?id=xxx&kind=resource|video — admin removes content. */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const kind = req.nextUrl.searchParams.get("kind") ?? "resource";
  if (!isKind(kind)) return fail("Unknown content kind.");

  if (kind === "video") {
    await (await videosCol()).deleteOne({ id });
  } else {
    await (await resourcesCol()).deleteOne({ id });
  }
  return NextResponse.json({ ok: true });
}
