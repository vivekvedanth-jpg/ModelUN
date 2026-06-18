import { type NextRequest, NextResponse } from "next/server";
import { committeesCol, type CommitteeDoc, type ScoreColumn, type CommitteeDelegate, type SpeakerEntry } from "@/lib/server/db";
import { getSessionUser, isOwnerDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COLUMN_LABELS = ["GSL", "Mod Caucus", "Unmod Caucus", "Resolution", "Diplomacy"];

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultColumns(): ScoreColumn[] {
  return DEFAULT_COLUMN_LABELS.map((label) => ({ id: makeId(), label }));
}

function canManage(me: { email: string; role: string }, committee: CommitteeDoc): boolean {
  return isOwnerDoc(me as never) || committee.chair.toLowerCase() === me.email.toLowerCase();
}

/** GET — list committees for the current user. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (me.role !== "chair" && !isOwnerDoc(me)) return fail("Chairs and owners only.", 403);

  const col = await committeesCol();
  const filter = isOwnerDoc(me) ? {} : { chair: new RegExp(`^${me.email}$`, "i") };
  const docs = await col.find(filter).toArray();
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ committees: docs });
}

/** POST — create a committee. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (me.role !== "chair" && !isOwnerDoc(me)) return fail("Chairs and owners only.", 403);

  let body: { name?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const now = Date.now();
  const doc: CommitteeDoc = {
    id: makeId(),
    chair: me.email,
    name: body.name?.trim() || "New committee",
    conference: "",
    columns: defaultColumns(),
    delegates: [],
    speakers: [],
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  await (await committeesCol()).insertOne(doc);
  return NextResponse.json({ committee: doc }, { status: 201 });
}

/** PATCH — action-based mutation on a committee. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const id = body.id as string | undefined;
  const action = body.action as string | undefined;
  if (!id) return fail("Missing id.");
  if (!action) return fail("Missing action.");

  const col = await committeesCol();
  const committee = await col.findOne({ id });
  if (!committee) return fail("Committee not found.", 404);
  if (!canManage(me, committee)) return fail("Permission denied.", 403);

  const now = Date.now();

  switch (action) {
    case "rename": {
      const patch: Partial<CommitteeDoc> = { updatedAt: now };
      if (body.name !== undefined) patch.name = (body.name as string).trim() || "New committee";
      if (body.conference !== undefined) patch.conference = body.conference as string;
      await col.updateOne({ id }, { $set: patch });
      break;
    }
    case "add_column": {
      const label = ((body.label as string | undefined)?.trim()) || "New";
      const col2: ScoreColumn = { id: makeId(), label };
      await col.updateOne({ id }, { $push: { columns: col2 }, $set: { updatedAt: now } });
      break;
    }
    case "rename_column": {
      const { columnId, label } = body as { columnId: string; label: string };
      await col.updateOne(
        { id, "columns.id": columnId },
        { $set: { "columns.$.label": label, updatedAt: now } }
      );
      break;
    }
    case "remove_column": {
      const { columnId } = body as { columnId: string };
      // Pull column and clear its scores from every delegate.
      await col.updateOne(
        { id },
        {
          $pull: { columns: { id: columnId } as unknown as ScoreColumn },
          $set: { updatedAt: now },
        }
      );
      // Remove the score key from every delegate's scores object.
      const fresh = await col.findOne({ id });
      if (fresh) {
        const delegates: CommitteeDelegate[] = fresh.delegates.map((d) => {
          const scores = { ...d.scores };
          delete scores[columnId];
          return { ...d, scores };
        });
        await col.updateOne({ id }, { $set: { delegates, updatedAt: now } });
      }
      break;
    }
    case "add_delegate": {
      const name = (body.name as string | undefined)?.trim();
      if (!name) return fail("Delegate name is required.");
      const delegate: CommitteeDelegate = {
        id: makeId(),
        name,
        portfolio: (body.portfolio as string | undefined)?.trim() || undefined,
        scores: {},
      };
      await col.updateOne({ id }, { $push: { delegates: delegate }, $set: { updatedAt: now } });
      break;
    }
    case "remove_delegate": {
      const { delegateId } = body as { delegateId: string };
      await col.updateOne(
        { id },
        {
          $pull: { delegates: { id: delegateId } as unknown as CommitteeDelegate },
          $set: { updatedAt: now },
        }
      );
      break;
    }
    case "set_score": {
      const { delegateId, columnId, value } = body as {
        delegateId: string; columnId: string; value: number | null;
      };
      const fresh = await col.findOne({ id });
      if (!fresh) break;
      const delegates: CommitteeDelegate[] = fresh.delegates.map((d) => {
        if (d.id !== delegateId) return d;
        const scores = { ...d.scores };
        if (value === null || !Number.isFinite(value)) {
          delete scores[columnId];
        } else {
          scores[columnId] = value;
        }
        return { ...d, scores };
      });
      await col.updateOne({ id }, { $set: { delegates, updatedAt: now } });
      break;
    }
    case "add_speaker": {
      const name = (body.name as string | undefined)?.trim();
      if (!name) return fail("Speaker name is required.");
      const speaker: SpeakerEntry = { id: makeId(), name, done: false };
      await col.updateOne({ id }, { $push: { speakers: speaker }, $set: { updatedAt: now } });
      break;
    }
    case "remove_speaker": {
      const { speakerId } = body as { speakerId: string };
      const fresh = await col.findOne({ id });
      if (!fresh) break;
      const speakers = fresh.speakers.filter((s) => s.id !== speakerId);
      const patch: Partial<CommitteeDoc> = { speakers, updatedAt: now };
      if (fresh.currentSpeakerId === speakerId) patch.currentSpeakerId = undefined;
      await col.updateOne({ id }, { $set: patch });
      break;
    }
    case "move_speaker": {
      const { speakerId, dir } = body as { speakerId: string; dir: -1 | 1 };
      const fresh = await col.findOne({ id });
      if (!fresh) break;
      const speakers = [...fresh.speakers];
      const i = speakers.findIndex((s) => s.id === speakerId);
      const j = i + dir;
      if (i >= 0 && j >= 0 && j < speakers.length) {
        [speakers[i], speakers[j]] = [speakers[j], speakers[i]];
        await col.updateOne({ id }, { $set: { speakers, updatedAt: now } });
      }
      break;
    }
    case "set_current_speaker": {
      const speakerId = (body.speakerId as string | null) ?? null;
      await col.updateOne(
        { id },
        { $set: { currentSpeakerId: speakerId ?? undefined, updatedAt: now } }
      );
      break;
    }
    case "toggle_speaker_done": {
      const { speakerId } = body as { speakerId: string };
      const fresh = await col.findOne({ id });
      if (!fresh) break;
      const speakers = fresh.speakers.map((s) =>
        s.id === speakerId ? { ...s, done: !s.done } : s
      );
      await col.updateOne({ id }, { $set: { speakers, updatedAt: now } });
      break;
    }
    case "clear_speakers": {
      await col.updateOne(
        { id },
        { $set: { speakers: [], currentSpeakerId: undefined, updatedAt: now } }
      );
      break;
    }
    case "set_published": {
      await col.updateOne({ id }, { $set: { published: !!body.published, updatedAt: now } });
      break;
    }
    default:
      return fail(`Unknown action: ${action}`);
  }

  const updated = await col.findOne({ id });
  return NextResponse.json({ committee: updated });
}

/** DELETE — remove a committee. */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing id.");

  const col = await committeesCol();
  const committee = await col.findOne({ id });
  if (!committee) return NextResponse.json({ ok: true });
  if (!canManage(me, committee)) return fail("Permission denied.", 403);

  await col.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
