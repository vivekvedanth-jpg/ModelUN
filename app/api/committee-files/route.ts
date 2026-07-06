import { type NextRequest, NextResponse } from "next/server";
import {
  committeesCol, committeeFilesCol,
  type CommitteeDoc, type CommitteeFileDoc, type UserDoc,
} from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~4 MB decoded — base64 inflates payloads by 4/3, so cap the data URL length.
const MAX_DATA_URL_CHARS = 5_600_000;
const MAX_NAME_CHARS = 120;
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function lc(s: string): string {
  return s.trim().toLowerCase();
}

/** Chairs manage their own committee; admins and the owner manage every one. */
function canManage(me: UserDoc, committee: CommitteeDoc): boolean {
  return isAdminDoc(me) || lc(committee.chair) === lc(me.email);
}

/** A member can view shared files: anyone managing it, or a linked delegate. */
function isMember(me: UserDoc, committee: CommitteeDoc): boolean {
  if (canManage(me, committee)) return true;
  return committee.delegates.some((d) => d.email && lc(d.email) === lc(me.email));
}

/** Metadata view — everything except the (potentially huge) dataUrl. */
function toMeta(f: CommitteeFileDoc) {
  return {
    id: f.id,
    committeeId: f.committeeId,
    name: f.name,
    mime: f.mime,
    size: f.size,
    uploadedBy: f.uploadedBy,
    uploaderName: f.uploaderName,
    createdAt: f.createdAt,
  };
}

/** GET — ?committeeId= lists metadata; ?id= returns one file with data (members only). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const fileId = req.nextUrl.searchParams.get("id");
  const committeeId = req.nextUrl.searchParams.get("committeeId");
  const files = await committeeFilesCol();

  if (fileId) {
    const file = await files.findOne({ id: fileId });
    if (!file) return fail("File not found.", 404);
    const committee = await (await committeesCol()).findOne({ id: file.committeeId });
    if (!committee || !isMember(me, committee)) return fail("You're not in this committee.", 403);
    return NextResponse.json({ file: { ...toMeta(file), dataUrl: file.dataUrl } });
  }

  if (!committeeId) return fail("Missing committeeId.");
  const committee = await (await committeesCol()).findOne({ id: committeeId });
  if (!committee) return fail("Committee not found.", 404);
  if (!isMember(me, committee)) return fail("You're not in this committee.", 403);

  const docs = await files.find({ committeeId }).toArray();
  docs.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ files: docs.map(toMeta) });
}

/** POST — upload a document to a committee (chair/admin only). */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: { committeeId?: string; name?: string; mime?: string; dataUrl?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  if (!body.committeeId || typeof body.committeeId !== "string") return fail("Missing committeeId.");
  const committee = await (await committeesCol()).findOne({ id: body.committeeId });
  if (!committee) return fail("Committee not found.", 404);
  if (!canManage(me, committee)) return fail("Permission denied.", 403);

  const name = body.name?.trim();
  if (!name) return fail("File name is required.");
  if (name.length > MAX_NAME_CHARS) return fail(`File name is too long (${MAX_NAME_CHARS} characters max).`);

  const mime = body.mime ?? "";
  if (!ALLOWED_MIMES.has(mime)) {
    return fail("That file type isn't supported — upload a PDF, image, Word document or plain text file.");
  }

  const dataUrl = body.dataUrl ?? "";
  if (!dataUrl.startsWith("data:")) return fail("Invalid file data.");
  if (dataUrl.length > MAX_DATA_URL_CHARS) return fail("That file is too big — keep uploads under 4 MB.");

  // Approximate decoded size from the base64 payload after the comma.
  const base64Length = dataUrl.length - (dataUrl.indexOf(",") + 1);
  const size = Math.floor((Math.max(0, base64Length) * 3) / 4);

  const doc: CommitteeFileDoc = {
    id: makeId(),
    committeeId: committee.id,
    name,
    mime,
    size,
    dataUrl,
    uploadedBy: lc(me.email),
    uploaderName: me.profile?.fullName?.trim() || me.email.split("@")[0],
    createdAt: Date.now(),
  };
  await (await committeeFilesCol()).insertOne(doc);
  return NextResponse.json({ file: toMeta(doc) }, { status: 201 });
}

/** DELETE — remove a shared file (managers of its committee only). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const files = await committeeFilesCol();
  const file = await files.findOne({ id });
  if (!file) return NextResponse.json({ ok: true });

  const committee = await (await committeesCol()).findOne({ id: file.committeeId });
  // If the committee itself was deleted, let admins clean up the orphan.
  const allowed = committee ? canManage(me, committee) : isAdminDoc(me);
  if (!allowed) return fail("Permission denied.", 403);

  await files.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
