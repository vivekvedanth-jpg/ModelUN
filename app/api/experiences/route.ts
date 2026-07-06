import { type NextRequest, NextResponse } from "next/server";
import type { UpdateFilter } from "mongodb";
import { experiencesCol, PLACEMENTS, type ExperienceDoc } from "@/lib/server/db";
import {
  getSessionUser,
  isAdminDoc,
  isGuestDoc,
  emailPattern,
  fail,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Data-URL length cap (~2 MB decoded once base64 overhead is stripped). */
const MAX_SCORECARD_CHARS = 2_800_000;

interface ExperienceBody {
  conference?: string;
  date?: string;
  committee?: string;
  portfolio?: string;
  placement?: string;
  notes?: string;
  scorecardName?: string | null;
  /** null on PATCH means "remove the scorecard". */
  scorecardDataUrl?: string | null;
}

/**
 * Validates whichever experience fields are present on a POST/PATCH body.
 * Returns an error message, or null when everything provided is acceptable.
 */
function validateExperienceFields(body: ExperienceBody): string | null {
  if (
    body.conference !== undefined &&
    (typeof body.conference !== "string" || !body.conference.trim())
  ) {
    return "Conference name is required.";
  }
  if (body.date !== undefined && (typeof body.date !== "string" || !DATE_RE.test(body.date))) {
    return "Date must be in YYYY-MM-DD format.";
  }
  if (
    body.placement !== undefined &&
    (typeof body.placement !== "string" ||
      !(PLACEMENTS as readonly string[]).includes(body.placement))
  ) {
    return "Placement must be one of the standard awards.";
  }
  if (body.scorecardDataUrl !== undefined && body.scorecardDataUrl !== null) {
    if (typeof body.scorecardDataUrl !== "string" || !body.scorecardDataUrl.startsWith("data:")) {
      return "Scorecard must be an uploaded file.";
    }
    if (body.scorecardDataUrl.length > MAX_SCORECARD_CHARS) {
      return "Scorecard file is too large (about 2 MB max).";
    }
  }
  return null;
}

/** GET — own experiences, another owner's (admins only), or all (admin, no param). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const col = await experiencesCol();
  const ownerParam = req.nextUrl.searchParams.get("owner");

  let docs: ExperienceDoc[];
  if (ownerParam) {
    // You may only read your own experiences unless you're an admin.
    const isSelf = emailPattern(ownerParam).test(me.email);
    if (!isSelf && !isAdminDoc(me)) return fail("Permission denied.", 403);
    docs = await col.find({ owner: emailPattern(ownerParam) }).toArray();
  } else if (isAdminDoc(me)) {
    docs = await col.find({}).toArray();
  } else {
    docs = await col.find({ owner: emailPattern(me.email) }).toArray();
  }

  docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  return NextResponse.json({ experiences: docs });
}

/** POST — add an experience for the signed-in delegate. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't log conferences.", 403);

  let body: ExperienceBody;
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  if (typeof body.conference !== "string" || !body.conference.trim()) {
    return fail("Conference name is required.");
  }
  if (typeof body.date !== "string" || !body.date) {
    return fail("Conference date is required.");
  }
  const invalid = validateExperienceFields(body);
  if (invalid) return fail(invalid);

  const doc: ExperienceDoc = {
    id: makeId(),
    owner: me.email,
    conference: body.conference.trim(),
    date: body.date,
    committee: (typeof body.committee === "string" && body.committee.trim()) || "—",
    portfolio: (typeof body.portfolio === "string" && body.portfolio.trim()) || "—",
    placement: body.placement || "Other / None",
    notes: (typeof body.notes === "string" && body.notes.trim()) || undefined,
    scorecardName:
      typeof body.scorecardName === "string" ? body.scorecardName.trim() || undefined : undefined,
    scorecardDataUrl: typeof body.scorecardDataUrl === "string" ? body.scorecardDataUrl : undefined,
    createdAt: Date.now(),
  };

  await (await experiencesCol()).insertOne(doc);
  return NextResponse.json({ experience: doc }, { status: 201 });
}

/** PATCH — edit an experience in place (owner or admin). */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't log conferences.", 403);

  let body: ExperienceBody & { id?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  if (typeof body.id !== "string" || !body.id) return fail("Missing id.");
  const invalid = validateExperienceFields(body);
  if (invalid) return fail(invalid);

  const col = await experiencesCol();
  const doc = await col.findOne({ id: body.id });
  if (!doc) return fail("Not found.", 404);

  const isOwner = emailPattern(me.email).test(doc.owner);
  if (!isOwner && !isAdminDoc(me)) return fail("Permission denied.", 403);

  const set: Partial<ExperienceDoc> = {};
  const unset: Partial<Record<"notes" | "scorecardName" | "scorecardDataUrl", "">> = {};

  if (typeof body.conference === "string") set.conference = body.conference.trim();
  if (typeof body.date === "string") set.date = body.date;
  if (typeof body.committee === "string") set.committee = body.committee.trim() || "—";
  if (typeof body.portfolio === "string") set.portfolio = body.portfolio.trim() || "—";
  if (typeof body.placement === "string") set.placement = body.placement;
  if (typeof body.notes === "string") {
    const trimmed = body.notes.trim();
    if (trimmed) set.notes = trimmed;
    else unset.notes = "";
  }
  if (body.scorecardDataUrl === null) {
    unset.scorecardName = "";
    unset.scorecardDataUrl = "";
  } else if (typeof body.scorecardDataUrl === "string") {
    set.scorecardDataUrl = body.scorecardDataUrl;
    if (typeof body.scorecardName === "string" && body.scorecardName.trim()) {
      set.scorecardName = body.scorecardName.trim();
    }
  }

  const update: UpdateFilter<ExperienceDoc> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;
  if (Object.keys(update).length === 0) return NextResponse.json({ experience: doc });

  await col.updateOne({ id: body.id }, update);
  const updated = await col.findOne({ id: body.id });
  return NextResponse.json({ experience: updated ?? doc });
}

/** DELETE — remove by id (own or admin). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't log conferences.", 403);

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
