import { type NextRequest, NextResponse } from "next/server";
import {
  committeesCol, usersCol,
  type CommitteeDoc, type ScoreColumn, type CommitteeDelegate, type SpeakerEntry,
  type VoteRecord, type VoteThreshold, type CommitteeMessage, type SessionStatus,
  type UserDoc,
} from "@/lib/server/db";
import { getSessionUser, isAdminDoc, isOwnerDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COLUMN_LABELS = ["GSL", "Mod Caucus", "Unmod Caucus", "Resolution", "Diplomacy"];
const MAX_VOTE_SECONDS = 120;
const MAX_MESSAGES = 200;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultColumns(): ScoreColumn[] {
  return DEFAULT_COLUMN_LABELS.map((label) => ({ id: makeId(), label }));
}

function lc(s: string): string {
  return s.trim().toLowerCase();
}

/** Chairs manage their own committee; admins and the owner manage every one. */
function canManage(me: UserDoc, committee: CommitteeDoc): boolean {
  return isAdminDoc(me) || lc(committee.chair) === lc(me.email);
}

/** A member can vote and chat: anyone managing it, or a linked delegate. */
function isMember(me: UserDoc, committee: CommitteeDoc): boolean {
  if (canManage(me, committee)) return true;
  return committee.delegates.some((d) => d.email && lc(d.email) === lc(me.email));
}

function voteClosed(v: VoteRecord, now = Date.now()): boolean {
  return v.closed || now >= v.startedAt + v.durationSec * 1000;
}

/**
 * Shape a committee for a given viewer: chairs/admins see everything; delegates
 * get filtered messages, no raw ballots, and scores only once published.
 */
function serialize(committee: CommitteeDoc, me: UserDoc) {
  const manager = canManage(me, committee);
  const myEmail = lc(me.email);

  // Vote view — hide other people's ballots from delegates.
  let vote: unknown = undefined;
  if (committee.vote) {
    const v = committee.vote;
    const ballots = Array.isArray(v.ballots) ? v.ballots : [];
    const yes = ballots.filter((b) => b.choice === "yes").length;
    const no = ballots.filter((b) => b.choice === "no").length;
    const closed = voteClosed(v);
    const showTally = manager || closed;
    vote = {
      id: v.id,
      title: v.title,
      threshold: v.threshold,
      startedAt: v.startedAt,
      durationSec: v.durationSec,
      closed: v.closed,
      voterCount: ballots.length,
      myVote: ballots.find((b) => lc(b.email) === myEmail)?.choice ?? null,
      tally: showTally ? { yes, no, total: yes + no } : null,
    };
  }

  // Messages — delegates only see committee-wide ones plus their own DMs.
  const allMsgs = committee.messages ?? [];
  const messages = manager
    ? allMsgs
    : allMsgs.filter(
        (m) => !m.toEmail || lc(m.authorEmail) === myEmail || lc(m.toEmail) === myEmail
      );

  // Scores stay private until published (for non-managers).
  const delegates =
    manager || committee.published
      ? committee.delegates
      : committee.delegates.map((d) => ({ ...d, scores: {} }));

  return {
    id: committee.id,
    chair: committee.chair,
    name: committee.name,
    conference: committee.conference,
    columns: committee.columns,
    delegates,
    speakers: committee.speakers,
    currentSpeakerId: committee.currentSpeakerId,
    published: committee.published,
    vote,
    messages,
    session: committee.session,
    createdAt: committee.createdAt,
    updatedAt: committee.updatedAt,
    canManage: manager,
  };
}

/** GET — committees for the current user, or ?accounts=1 for the chair's roster. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  // Roster of addable accounts (for chairs/admins/owner adding delegates).
  if (req.nextUrl.searchParams.get("accounts") === "1") {
    if (me.role !== "chair" && !isAdminDoc(me)) return fail("Not allowed.", 403);
    const docs = await (await usersCol()).find({ role: { $ne: "owner" } }).toArray();
    const accounts = docs
      .map((u) => ({
        email: u.email,
        name: u.profile?.fullName?.trim() || u.email.split("@")[0],
        role: u.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ accounts });
  }

  const col = await committeesCol();
  let docs: CommitteeDoc[];
  if (isAdminDoc(me)) {
    docs = await col.find({}).toArray();
  } else if (me.role === "chair") {
    docs = await col.find({ chair: new RegExp(`^${me.email}$`, "i") }).toArray();
  } else {
    // A delegate sees only the committees they've been added to.
    docs = await col.find({ "delegates.email": new RegExp(`^${me.email}$`, "i") }).toArray();
  }
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ committees: docs.map((c) => serialize(c, me)) });
}

/** POST — create a committee (chairs/admins/owner). */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (me.role !== "chair" && !isAdminDoc(me)) return fail("Chairs and owners only.", 403);

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
    messages: [],
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  await (await committeesCol()).insertOne(doc);
  return NextResponse.json({ committee: serialize(doc, me) }, { status: 201 });
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

  // Members (delegates) may cast votes and send messages; everything else is
  // chair/admin-only management.
  const memberActions = new Set(["cast_vote", "send_message"]);
  if (memberActions.has(action)) {
    if (!isMember(me, committee)) return fail("You're not in this committee.", 403);
  } else {
    if (!canManage(me, committee)) return fail("Permission denied.", 403);
  }

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
      await col.updateOne(
        { id },
        {
          $pull: { columns: { id: columnId } as unknown as ScoreColumn },
          $set: { updatedAt: now },
        }
      );
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
      const email = body.email ? lc(body.email as string) : undefined;
      if (!name && !email) return fail("Delegate name or account is required.");

      if (email) {
        const account = await (await usersCol()).findOne({ email: new RegExp(`^${email}$`, "i") });
        if (!account) return fail("No account exists with that email — create the delegate's account first.");
        const dupe = committee.delegates.some((d) => d.email && lc(d.email) === email);
        if (dupe) return fail("That delegate is already in this committee.");
      }

      const delegate: CommitteeDelegate = {
        id: makeId(),
        name: name || email!.split("@")[0],
        portfolio: (body.portfolio as string | undefined)?.trim() || undefined,
        scores: {},
        email,
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

    /* ── Voting ── */
    case "start_vote": {
      const title = (body.title as string | undefined)?.trim();
      if (!title) return fail("Give the vote a title.");
      const threshold: VoteThreshold = body.threshold === "twothirds" ? "twothirds" : "simple";
      let durationSec = Math.round(Number(body.durationSec));
      if (!Number.isFinite(durationSec) || durationSec <= 0) durationSec = 30;
      durationSec = Math.min(MAX_VOTE_SECONDS, Math.max(5, durationSec));
      const vote: VoteRecord = {
        id: makeId(),
        title,
        threshold,
        startedAt: now,
        durationSec,
        closed: false,
        ballots: [],
      };
      await col.updateOne({ id }, { $set: { vote, updatedAt: now } });
      break;
    }
    case "cast_vote": {
      const choice = body.choice === "yes" ? "yes" : body.choice === "no" ? "no" : null;
      if (!choice) return fail("Choose yes or no.");
      const v = committee.vote;
      if (!v) return fail("There's no active vote.");
      if (voteClosed(v)) return fail("Voting has closed.");
      const email = lc(me.email);
      // Legacy votes stored ballots as an object; normalise to an array first so
      // $pull/$push don't fail on a non-array field.
      if (!Array.isArray(v.ballots)) {
        await col.updateOne({ id }, { $set: { "vote.ballots": [] } });
      }
      // Atomic per-voter: drop any prior ballot from this email, then add the new
      // one. Scoped to this email so concurrent voters never clobber each other.
      await col.updateOne({ id }, { $pull: { "vote.ballots": { email } } });
      await col.updateOne(
        { id },
        { $push: { "vote.ballots": { email, choice } }, $set: { updatedAt: now } }
      );
      break;
    }
    case "extend_vote": {
      const v = committee.vote;
      if (!v) return fail("There's no active vote.");
      if (v.closed) return fail("That vote is already closed.");
      let addSec = Math.round(Number(body.addSec));
      if (!Number.isFinite(addSec) || addSec <= 0) addSec = 30;
      addSec = Math.min(MAX_VOTE_SECONDS, addSec);
      const deadline = v.startedAt + v.durationSec * 1000;
      if (now >= deadline) {
        // Timer already lapsed (but not manually closed) — reopen for addSec more.
        await col.updateOne(
          { id },
          { $set: { "vote.startedAt": now, "vote.durationSec": addSec, updatedAt: now } }
        );
      } else {
        await col.updateOne(
          { id },
          { $set: { "vote.durationSec": v.durationSec + addSec, updatedAt: now } }
        );
      }
      break;
    }
    case "close_vote": {
      if (!committee.vote) break;
      await col.updateOne({ id }, { $set: { "vote.closed": true, updatedAt: now } });
      break;
    }
    case "clear_vote": {
      await col.updateOne({ id }, { $unset: { vote: "" }, $set: { updatedAt: now } });
      break;
    }

    /* ── Messaging ── */
    case "send_message": {
      const text = (body.text as string | undefined)?.trim();
      if (!text) return fail("Message can't be empty.");
      if (text.length > 1000) return fail("Message is too long.");
      const toEmail = body.toEmail ? lc(body.toEmail as string) : undefined;
      const message: CommitteeMessage = {
        id: makeId(),
        authorEmail: lc(me.email),
        authorName: me.profile?.fullName?.trim() || me.email.split("@")[0],
        toEmail,
        text,
        createdAt: now,
      };
      await col.updateOne(
        { id },
        {
          $push: { messages: { $each: [message], $slice: -MAX_MESSAGES } },
          $set: { updatedAt: now },
        }
      );
      break;
    }
    case "clear_messages": {
      await col.updateOne({ id }, { $set: { messages: [], updatedAt: now } });
      break;
    }

    /* ── Session status ── */
    case "set_session": {
      const label = (body.label as string | undefined)?.trim();
      if (!label) return fail("Name the session activity.");
      let durationSec: number | undefined = Math.round(Number(body.durationSec));
      if (!Number.isFinite(durationSec) || durationSec <= 0) durationSec = undefined;
      const session: SessionStatus = { label, startedAt: now, durationSec };
      await col.updateOne({ id }, { $set: { session, updatedAt: now } });
      break;
    }
    case "clear_session": {
      await col.updateOne({ id }, { $unset: { session: "" }, $set: { updatedAt: now } });
      break;
    }

    default:
      return fail(`Unknown action: ${action}`);
  }

  const updated = await col.findOne({ id });
  return NextResponse.json({ committee: updated ? serialize(updated, me) : null });
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
