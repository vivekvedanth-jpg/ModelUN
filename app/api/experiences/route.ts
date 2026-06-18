import { type NextRequest, NextResponse } from "next/server";
import { experiencesCol, type ExperienceDoc } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** GET — own experiences (no param) or all experiences (admin). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const col = await experiencesCol();
  const ownerParam = req.nextUrl.searchParams.get("owner");

  let docs: ExperienceDoc[];
  if (ownerParam) {
    docs = await col.find({ owner: new RegExp(`^${ownerParam}$`, "i") }).toArray();
  } else if (isAdminDoc(me)) {
    docs = await col.find({}).toArray();
  } else {
    docs = await col.find({ owner: new RegExp(`^${me.email}$`, "i") }).toArray();
  }

  docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  return NextResponse.json({ experiences: docs });
}

/** POST — add an experience for the signed-in delegate. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: {
    conference?: string; date?: string; committee?: string; portfolio?: string;
    placement?: string; notes?: string; scorecardName?: string; scorecardDataUrl?: string;
  };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  if (!body.conference?.trim()) return fail("Conference name is required.");
  if (!body.date) return fail("Conference date is required.");

  const doc: ExperienceDoc = {
    id: makeId(),
    owner: me.email,
    conference: body.conference.trim(),
    date: body.date,
    committee: body.committee?.trim() || "—",
    portfolio: body.portfolio?.trim() || "—",
    placement: body.placement || "Other / None",
    notes: body.notes?.trim() || undefined,
    scorecardName: body.scorecardName,
    scorecardDataUrl: body.scorecardDataUrl,
    createdAt: Date.now(),
  };

  await (await experiencesCol()).insertOne(doc);
  return NextResponse.json({ experience: doc }, { status: 201 });
}

/** DELETE — remove by id (own or admin). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const col = await experiencesCol();
  const doc = await col.findOne({ id });
  if (!doc) return fail("Not found.", 404);

  const isOwner = doc.owner.toLowerCase() === me.email.toLowerCase();
  if (!isOwner && !isAdminDoc(me)) return fail("Permission denied.", 403);

  await col.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
