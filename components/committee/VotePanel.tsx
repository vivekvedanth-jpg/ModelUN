"use client";

import { useEffect, useState } from "react";
import {
  startVote,
  castVote,
  extendVote,
  closeVote,
  clearVote,
  voteDecided,
  voteSecondsLeft,
  votePassed,
  thresholdLabel,
  MAX_VOTE_SECONDS,
  type Committee,
  type VoteThreshold,
} from "@/lib/committee";
import { ScaleIcon, CheckIcon, CloseIcon } from "../icons";

const DURATIONS = [30, 60, 90, 120];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VotePanel({
  committee,
  canManage,
  onUpdate,
}: {
  committee: Committee;
  canManage: boolean;
  onUpdate: (c: Committee) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState<VoteThreshold>("simple");
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const vote = committee.vote ?? null;

  async function run(fn: () => Promise<Committee>) {
    setBusy(true);
    setError("");
    try {
      onUpdate(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── No active vote ──
  if (!vote) {
    if (!canManage) {
      return (
        <div className="rounded-2xl border border-navy-100 bg-white px-5 py-8 text-center text-sm text-navy-500">
          No vote is running right now. When your chair starts one, it&apos;ll appear here.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <h3 className="flex items-center gap-2 font-bold text-navy-900">
          <ScaleIcon width={18} height={18} /> Start a vote
        </h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="vote-title">What&apos;s being voted on?</label>
            <input
              id="vote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mod caucus: Climate financing (5 min)"
              className="input-field !py-2.5"
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="label">Pass threshold</span>
              <div className="flex gap-1.5">
                {(["simple", "twothirds"] as VoteThreshold[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setThreshold(t)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      threshold === t
                        ? "border-navy-800 bg-navy-800 text-white"
                        : "border-navy-200 text-navy-700 hover:border-navy-400"
                    }`}
                  >
                    {t === "simple" ? "Simple (50%+1)" : "Two-thirds"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Timer (max {MAX_VOTE_SECONDS / 60} min)</span>
              <div className="flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      duration === d
                        ? "border-navy-800 bg-navy-800 text-white"
                        : "border-navy-200 text-navy-700 hover:border-navy-400"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => run(() => startVote(committee.id, { title, threshold, durationSec: duration }))}
            disabled={busy || !title.trim()}
            className="btn-gold !py-2.5"
          >
            Open voting
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Active or finished vote ──
  const decided = voteDecided(vote, now);
  const secs = voteSecondsLeft(vote, now);
  const tally = vote.tally;
  const passed = tally ? votePassed(vote.threshold, tally) : false;

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-navy-900">
            <ScaleIcon width={18} height={18} /> {vote.title}
          </h3>
          <p className="mt-0.5 text-xs text-navy-500">{thresholdLabel(vote.threshold)}</p>
        </div>
        {!decided ? (
          <span className="rounded-xl bg-navy-900 px-3 py-1.5 font-mono text-xl font-bold tabular-nums text-white">
            {fmt(secs)}
          </span>
        ) : (
          <span className="badge bg-navy-100 text-navy-600">Closed</span>
        )}
      </div>

      {/* Delegate voting buttons (members who don't manage) */}
      {!decided && !canManage && (
        <div className="mt-4">
          {vote.myVote ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
              You voted {vote.myVote.toUpperCase()} — you can change it until the timer ends.
            </div>
          ) : (
            <p className="mb-2 text-center text-sm text-navy-600">Cast your vote:</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              onClick={() => run(() => castVote(committee.id, "yes"))}
              disabled={busy}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition-colors ${
                vote.myVote === "yes"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckIcon width={18} height={18} /> Yes
            </button>
            <button
              onClick={() => run(() => castVote(committee.id, "no"))}
              disabled={busy}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition-colors ${
                vote.myVote === "no"
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-red-300 text-red-700 hover:bg-red-50"
              }`}
            >
              <CloseIcon width={18} height={18} /> No
            </button>
          </div>
        </div>
      )}

      {/* Live status while open */}
      {!decided && canManage && tally && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-700">{tally.yes}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Yes</div>
          </div>
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-center">
            <div className="text-2xl font-bold tabular-nums text-red-700">{tally.no}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-red-600">No</div>
          </div>
        </div>
      )}
      {!decided && (
        <p className="mt-3 text-center text-sm text-navy-500">
          {vote.voterCount} {vote.voterCount === 1 ? "vote" : "votes"} cast so far
        </p>
      )}

      {/* Waiting for server tally after timer expires */}
      {decided && !tally && (
        <p className="mt-4 text-center text-sm text-navy-500 animate-pulse">
          Calculating results…
        </p>
      )}

      {/* Results once decided */}
      {decided && tally && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{tally.yes}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Yes</div>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-red-700">{tally.no}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-600">No</div>
            </div>
          </div>
          <div
            className={`mt-3 rounded-xl py-3 text-center text-lg font-bold ${
              passed ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {passed ? "MOTION PASSES" : "MOTION FAILS"}
          </div>
          <p className="mt-2 text-center text-xs text-navy-500">
            {tally.total} {tally.total === 1 ? "vote" : "votes"} counted · {thresholdLabel(vote.threshold)}
          </p>
        </div>
      )}

      {/* Chair controls */}
      {canManage && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-navy-100 pt-4">
          {!decided && (
            <>
              <button onClick={() => run(() => extendVote(committee.id, 30))} disabled={busy} className="btn-ghost !py-2 text-sm">
                +30s
              </button>
              <button onClick={() => run(() => extendVote(committee.id, 60))} disabled={busy} className="btn-ghost !py-2 text-sm">
                +1 min
              </button>
              <button onClick={() => run(() => closeVote(committee.id))} disabled={busy} className="btn-ghost !py-2 text-sm">
                Close voting now
              </button>
            </>
          )}
          <button onClick={() => run(() => clearVote(committee.id))} disabled={busy} className="btn-ghost !py-2 text-sm text-red-600">
            Clear vote
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
