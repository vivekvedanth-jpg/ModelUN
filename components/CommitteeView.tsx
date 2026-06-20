"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getAllCommittees, totalFor, type Committee } from "@/lib/committee";
import SessionBanner from "./committee/SessionBanner";
import VotePanel from "./committee/VotePanel";
import ChatPanel from "./committee/ChatPanel";
import { ScaleIcon, MicIcon, CheckIcon } from "./icons";

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}`;
}

/**
 * Committee view for delegates: live session status, votes and chat, the
 * speaker list, and the full scorecard once the chair publishes it.
 */
export default function CommitteeView() {
  const { user } = useAuth();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  function load() {
    getAllCommittees().then((list) => {
      setCommittees(list);
      setActiveId((cur) =>
        cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null
      );
    }).catch(() => {});
  }

  // Poll faster when a vote is active so results appear quickly after the timer ends.
  const hasLiveVote = committees.some((c) => c.vote && !c.vote.closed);
  useEffect(() => {
    load();
    const interval = setInterval(load, hasLiveVote ? 2000 : 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLiveVote]);

  const active = useMemo(
    () => committees.find((c) => c.id === activeId) ?? null,
    [committees, activeId]
  );

  const applyUpdate = (u: Committee) =>
    setCommittees((prev) => prev.map((c) => (c.id === u.id ? u : c)));

  const standings = useMemo(() => {
    if (!active) return [];
    return [...active.delegates]
      .map((d) => ({ d, total: totalFor(active, d) }))
      .sort((a, b) => b.total - a.total || a.d.name.localeCompare(b.d.name));
  }, [active]);

  if (committees.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
          <ScaleIcon width={28} height={28} />
        </span>
        <h2 className="text-xl font-bold text-navy-900">No committee yet</h2>
        <p className="max-w-sm text-sm text-navy-600">
          Once your chair adds you to a committee, its session status, votes,
          chat and scores will appear here.
        </p>
        <button onClick={load} className="btn-ghost mt-2">
          Refresh
        </button>
      </div>
    );
  }

  const canManage = active?.canManage ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {committees.length > 1 &&
          committees.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`badge px-3.5 py-2 ${
                c.id === activeId
                  ? "bg-navy-800 text-white"
                  : "border border-navy-200 bg-white text-navy-700 hover:border-navy-400"
              }`}
            >
              <ScaleIcon width={14} height={14} /> {c.name || "Untitled"}
            </button>
          ))}
        <button onClick={load} className="badge bg-navy-100 px-3.5 py-2 text-navy-700 hover:bg-navy-200">
          Refresh
        </button>
      </div>

      {active && (
        <div className="space-y-8">
          {/* Header */}
          <div className="card">
            <h2 className="font-serif text-2xl font-bold text-navy-900">
              {active.name}
            </h2>
            {active.conference && (
              <p className="mt-1 text-sm text-navy-600">{active.conference}</p>
            )}
          </div>

          {/* Session status */}
          <SessionBanner committee={active} canManage={canManage} onUpdate={applyUpdate} />

          {/* Voting + chat */}
          <div className="grid gap-6 lg:grid-cols-2">
            <VotePanel committee={active} canManage={canManage} onUpdate={applyUpdate} />
            <ChatPanel
              committee={active}
              meEmail={user?.email ?? ""}
              canManage={canManage}
              onUpdate={applyUpdate}
            />
          </div>

          {/* Speaker list */}
          <div>
            <h2 className="text-xl font-bold text-navy-900">Speaker list</h2>
            <p className="mt-1 text-sm text-navy-600">
              The order of speakers for this committee.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-navy-100 bg-white">
              {active.speakers.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-navy-500">
                  Your chair hasn&apos;t posted a speaker list yet.
                </div>
              ) : (
                <ol className="divide-y divide-navy-100">
                  {active.speakers.map((s, i) => {
                    const current = s.id === active.currentSpeakerId;
                    return (
                      <li
                        key={s.id}
                        className={`flex items-center gap-3 px-5 py-3 ${
                          current ? "bg-emerald-50" : ""
                        }`}
                      >
                        <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-navy-500">
                          {i + 1}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate font-semibold ${
                            s.done && !current
                              ? "text-navy-400 line-through"
                              : "text-navy-900"
                          }`}
                        >
                          {s.name}
                        </span>
                        {current && (
                          <span className="badge bg-emerald-500 text-white">
                            <MicIcon width={12} height={12} /> Speaking now
                          </span>
                        )}
                        {s.done && !current && (
                          <span className="badge bg-navy-100 text-navy-600">
                            <CheckIcon width={12} height={12} /> Done
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Scores — only once the chair publishes them */}
          <div>
            <h2 className="text-xl font-bold text-navy-900">Scores</h2>
            {active.published ? (
              <>
                <p className="mt-1 text-sm text-navy-600">
                  Released by your chair — ranked by total points.
                </p>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
                  {standings.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-navy-500">
                      No scores were recorded.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-navy-50 text-navy-600">
                        <tr>
                          <th className="px-3 py-3 text-center font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Delegate</th>
                          {active.columns.map((col) => (
                            <th
                              key={col.id}
                              className="px-3 py-3 text-center font-semibold"
                            >
                              {col.label}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center font-semibold">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-100">
                        {standings.map(({ d, total }, i) => (
                          <tr
                            key={d.id}
                            className={i < 3 ? "bg-gold-50/40" : ""}
                          >
                            <td className="px-3 py-2.5 text-center text-lg font-bold text-navy-900">
                              {medal(i)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-navy-900">
                                {d.portfolio || d.name}
                              </div>
                              {d.portfolio && (
                                <div className="text-xs text-navy-500">
                                  {d.name}
                                </div>
                              )}
                            </td>
                            {active.columns.map((col) => (
                              <td
                                key={col.id}
                                className="px-3 py-2.5 text-center text-navy-700"
                              >
                                {d.scores[col.id] ?? 0}
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-center">
                              <span className="badge bg-gold-100 text-gold-700">
                                {total}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-navy-100 bg-navy-50/50 px-5 py-6 text-sm text-navy-600">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-500">
                  <CheckIcon width={18} height={18} />
                </span>
                Your chair will release the scores at the end of the session —
                check back then!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
