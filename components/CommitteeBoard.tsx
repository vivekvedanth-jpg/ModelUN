"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { getAccounts, isOwner, type AccountDetail } from "@/lib/auth";
import {
  getCommitteesForUser,
  createCommittee,
  renameCommittee,
  deleteCommittee,
  addColumn,
  renameColumn,
  removeColumn,
  addDelegate,
  removeDelegate,
  setScore,
  totalFor,
  addSpeaker,
  removeSpeaker,
  moveSpeaker,
  setCurrentSpeaker,
  toggleSpeakerDone,
  clearSpeakers,
  setPublished,
  type Committee,
} from "@/lib/committee";
import {
  ScaleIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  CloseIcon,
  MicIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "./icons";

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}`;
}

export default function CommitteeBoard() {
  const { user } = useAuth();
  const owner = isOwner(user);

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [error, setError] = useState("");

  // Add-delegate form.
  const [delName, setDelName] = useState("");
  const [delPortfolio, setDelPortfolio] = useState("");
  // Add-speaker form.
  const [speakerName, setSpeakerName] = useState("");

  const active = useMemo(
    () => committees.find((c) => c.id === activeId) ?? null,
    [committees, activeId]
  );

  useEffect(() => {
    if (!user) return;
    const list = getCommitteesForUser(user);
    setCommittees(list);
    setActiveId((cur) =>
      cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null
    );
    setAccounts(getAccounts());
  }, [user]);

  /** Runs an in-committee mutation and folds the updated committee back in. */
  function edit(fn: () => Committee) {
    setError("");
    try {
      const updated = fn();
      setCommittees((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function handleCreate() {
    setError("");
    try {
      const c = createCommittee(user);
      setCommittees((prev) => [c, ...prev]);
      setActiveId(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function handleDelete() {
    if (!active) return;
    if (
      !window.confirm(
        `Delete the committee "${active.name}" and all its scores? This cannot be undone.`
      )
    )
      return;
    setError("");
    try {
      const list = deleteCommittee(user, active.id);
      setCommittees(list);
      setActiveId(list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function handleAddDelegate(e: FormEvent) {
    e.preventDefault();
    if (!active || !delName.trim()) return;
    edit(() =>
      addDelegate(user, active.id, { name: delName, portfolio: delPortfolio })
    );
    setDelName("");
    setDelPortfolio("");
  }

  function handleAddSpeaker(e: FormEvent) {
    e.preventDefault();
    if (!active || !speakerName.trim()) return;
    edit(() => addSpeaker(user, active.id, speakerName));
    setSpeakerName("");
  }

  // Suggest registered delegates in the add-delegate field (select or type).
  // De-duplicated so the datalist never emits two options with the same value.
  const delegateSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          accounts
            .filter((a) => a.role === "normal")
            .map((a) => a.profile.fullName?.trim() || a.email.split("@")[0])
        )
      ),
    [accounts]
  );

  // Speaker suggestions come from this committee's own roster (names + countries).
  const speakerSuggestions = useMemo(() => {
    if (!active) return [];
    const set = new Set<string>();
    for (const d of active.delegates) {
      if (d.portfolio) set.add(d.portfolio);
      if (d.name) set.add(d.name);
    }
    return Array.from(set);
  }, [active]);

  // Standings = the committee's own ranking, by total points (stable on edit).
  const standings = useMemo(() => {
    if (!active) return [];
    return [...active.delegates]
      .map((d) => ({ d, total: totalFor(active, d) }))
      .sort((a, b) => b.total - a.total || a.d.name.localeCompare(b.d.name));
  }, [active]);

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {owner && (
        <p className="rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-600">
          You&apos;re viewing this as the Owner, so you can see and edit{" "}
          <strong>every</strong> chair&apos;s committee.
        </p>
      )}

      {/* Committee tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {committees.map((c) => (
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
        <button
          onClick={handleCreate}
          className="badge border-2 border-dashed border-emerald-300 bg-emerald-50 px-3.5 py-2 text-emerald-700 hover:bg-emerald-100"
        >
          <PlusIcon width={14} height={14} /> New committee
        </button>
      </div>

      {!active ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
            <ScaleIcon width={28} height={28} />
          </span>
          <h2 className="text-xl font-bold text-navy-900">No committees yet</h2>
          <p className="max-w-sm text-sm text-navy-600">
            Create a committee, add your delegates, and score them on GSL,
            caucuses, resolutions and any custom categories you like.
          </p>
          <button onClick={handleCreate} className="btn-primary mt-2">
            <PlusIcon width={16} height={16} /> Create your first committee
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Committee header */}
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  value={active.name}
                  onChange={(e) =>
                    edit(() =>
                      renameCommittee(user, active.id, { name: e.target.value })
                    )
                  }
                  placeholder="Committee name (e.g. UNSC)"
                  className="w-full bg-transparent font-serif text-2xl font-bold text-navy-900 outline-none placeholder:text-silver-500"
                />
                <input
                  value={active.conference ?? ""}
                  onChange={(e) =>
                    edit(() =>
                      renameCommittee(user, active.id, {
                        conference: e.target.value,
                      })
                    )
                  }
                  placeholder="Conference / session (optional)"
                  className="mt-1 w-full bg-transparent text-sm text-navy-600 outline-none placeholder:text-silver-500"
                />
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="badge bg-navy-50 text-navy-600">
                    <UsersIcon width={13} height={13} /> {active.delegates.length}{" "}
                    {active.delegates.length === 1 ? "delegate" : "delegates"}
                  </span>
                  <span className="badge bg-navy-50 text-navy-600">
                    {active.columns.length}{" "}
                    {active.columns.length === 1 ? "category" : "categories"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <TrashIcon width={14} height={14} /> Delete committee
              </button>
            </div>
          </div>

          {/* Speaker list (GSL) — delegates see this live on their Committee page */}
          <div>
            <h2 className="text-xl font-bold text-navy-900">Speaker list</h2>
            <p className="mt-1 text-sm text-navy-600">
              Add countries in speaking order. Delegates see this live on their
              Committee page.
            </p>

            <form
              onSubmit={handleAddSpeaker}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              <input
                list="committee-speaker-options"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="Country or delegate to add"
                aria-label="Add a speaker"
                className="input-field !py-2.5 max-w-xs flex-1"
              />
              <datalist id="committee-speaker-options">
                {speakerSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!speakerName.trim()}
                className="btn-primary !py-2.5"
              >
                <PlusIcon width={16} height={16} /> Add
              </button>
              {active.speakers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear the whole speaker list?"))
                      edit(() => clearSpeakers(user, active.id));
                  }}
                  className="btn-ghost !py-2.5"
                >
                  Clear all
                </button>
              )}
            </form>

            <div className="mt-4 overflow-hidden rounded-2xl border border-navy-100 bg-white">
              {active.speakers.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-navy-500">
                  No speakers yet — add countries above to build the order.
                </div>
              ) : (
                <ol className="divide-y divide-navy-100">
                  {active.speakers.map((s, i) => {
                    const current = s.id === active.currentSpeakerId;
                    return (
                      <li
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${
                          current
                            ? "bg-emerald-50"
                            : s.done
                            ? "bg-navy-50/40"
                            : ""
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
                            Speaking
                          </span>
                        )}
                        {s.done && !current && (
                          <span className="badge bg-navy-100 text-navy-600">
                            Done
                          </span>
                        )}
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            onClick={() =>
                              edit(() =>
                                setCurrentSpeaker(
                                  user,
                                  active.id,
                                  current ? null : s.id
                                )
                              )
                            }
                            title={current ? "Stop speaking" : "Set as speaking"}
                            aria-label="Set as speaking"
                            className={`rounded-lg border p-1.5 ${
                              current
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border-navy-200 text-navy-600 hover:bg-navy-50"
                            }`}
                          >
                            <MicIcon width={14} height={14} />
                          </button>
                          <button
                            onClick={() =>
                              edit(() =>
                                toggleSpeakerDone(user, active.id, s.id)
                              )
                            }
                            title="Mark done"
                            aria-label="Mark done"
                            className={`rounded-lg border p-1.5 ${
                              s.done
                                ? "border-navy-300 bg-navy-100 text-navy-700"
                                : "border-navy-200 text-navy-600 hover:bg-navy-50"
                            }`}
                          >
                            <CheckIcon width={14} height={14} />
                          </button>
                          <button
                            onClick={() =>
                              edit(() => moveSpeaker(user, active.id, s.id, -1))
                            }
                            disabled={i === 0}
                            aria-label="Move up"
                            className="rounded-lg border border-navy-200 p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30"
                          >
                            <ArrowUpIcon width={14} height={14} />
                          </button>
                          <button
                            onClick={() =>
                              edit(() => moveSpeaker(user, active.id, s.id, 1))
                            }
                            disabled={i === active.speakers.length - 1}
                            aria-label="Move down"
                            className="rounded-lg border border-navy-200 p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30"
                          >
                            <ArrowDownIcon width={14} height={14} />
                          </button>
                          <button
                            onClick={() =>
                              edit(() => removeSpeaker(user, active.id, s.id))
                            }
                            aria-label="Remove speaker"
                            className="rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
                          >
                            <TrashIcon width={14} height={14} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Standings — the committee's own ranking */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-navy-900">Standings</h2>
                <p className="mt-1 text-sm text-navy-600">
                  {active.published
                    ? "Published — delegates can see these scores on their Committee page."
                    : "Hidden — only you can see these scores until you publish them."}
                </p>
              </div>
              <button
                onClick={() =>
                  edit(() =>
                    setPublished(user, active.id, !active.published)
                  )
                }
                className={active.published ? "btn-ghost !py-2" : "btn-gold !py-2"}
              >
                {active.published ? "Hide from delegates" : "Publish scores"}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-navy-100 bg-white">
              {standings.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-navy-500">
                  Add delegates and award points to see the standings.
                </div>
              ) : (
                <ul className="divide-y divide-navy-100">
                  {standings.map(({ d, total }, i) => (
                    <li
                      key={d.id}
                      className={`flex items-center gap-3 px-5 py-3 ${
                        i < 3 ? "bg-gold-50/50" : ""
                      }`}
                    >
                      <span className="w-8 flex-shrink-0 text-center text-lg font-bold text-navy-900">
                        {medal(i)}
                      </span>
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                        {(d.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-navy-900">
                          {d.name}
                        </div>
                        {d.portfolio && (
                          <div className="truncate text-xs text-navy-500">
                            {d.portfolio}
                          </div>
                        )}
                      </div>
                      <span className="badge bg-gold-100 text-gold-700">
                        {total} pts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Scoring sheet */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-navy-900">Scoring sheet</h2>
                <p className="mt-1 text-sm text-navy-600">
                  Type scores straight into the grid. Add or remove categories and
                  delegates as you like — everything saves automatically.
                </p>
              </div>
              <button
                onClick={() => edit(() => addColumn(user, active.id))}
                className="btn-ghost !px-4 !py-2 text-sm"
              >
                <PlusIcon width={16} height={16} /> Add category
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-navy-50 text-navy-600">
                  <tr>
                    <th className="sticky left-0 z-10 bg-navy-50 px-4 py-3 font-semibold">
                      Delegate
                    </th>
                    {active.columns.map((col) => (
                      <th key={col.id} className="px-2 py-2 font-semibold">
                        <div className="group flex items-center justify-center gap-0.5">
                          <input
                            value={col.label}
                            onChange={(e) =>
                              edit(() =>
                                renameColumn(
                                  user,
                                  active.id,
                                  col.id,
                                  e.target.value
                                )
                              )
                            }
                            aria-label="Category name"
                            className="w-24 rounded-md bg-transparent px-1.5 py-1 text-center text-xs font-bold uppercase tracking-wide text-navy-700 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-300"
                          />
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove the "${col.label}" category from every delegate?`
                                )
                              )
                                edit(() =>
                                  removeColumn(user, active.id, col.id)
                                );
                            }}
                            aria-label="Remove category"
                            className="flex-shrink-0 rounded p-0.5 text-navy-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                          >
                            <CloseIcon width={13} height={13} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold">Total</th>
                    <th className="px-2 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {active.delegates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={active.columns.length + 3}
                        className="px-4 py-8 text-center text-sm text-navy-500"
                      >
                        No delegates yet — add your committee&apos;s delegates
                        below.
                      </td>
                    </tr>
                  ) : (
                    active.delegates.map((d) => (
                      <tr key={d.id} className="hover:bg-navy-50/40">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                          <div className="font-semibold text-navy-900">
                            {d.name}
                          </div>
                          {d.portfolio && (
                            <div className="text-xs text-navy-500">
                              {d.portfolio}
                            </div>
                          )}
                        </td>
                        {active.columns.map((col) => (
                          <td key={col.id} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              // Uncontrolled: keeps the chair's keystrokes (incl.
                              // negatives/decimals) intact while totals update live.
                              defaultValue={d.scores[col.id] ?? ""}
                              onChange={(e) =>
                                edit(() =>
                                  setScore(
                                    user,
                                    active.id,
                                    d.id,
                                    col.id,
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value)
                                  )
                                )
                              }
                              aria-label={`${d.name} — ${col.label}`}
                              placeholder="0"
                              className="no-spin w-16 rounded-lg border border-navy-200 px-2 py-1.5 text-center text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/30"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center">
                          <span className="badge bg-gold-100 text-gold-700">
                            {totalFor(active, d)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${d.name} from this committee?`
                                )
                              )
                                edit(() =>
                                  removeDelegate(user, active.id, d.id)
                                );
                            }}
                            aria-label="Remove delegate"
                            className="rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
                          >
                            <TrashIcon width={15} height={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add delegate */}
            <form
              onSubmit={handleAddDelegate}
              className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/40 p-4"
            >
              <div className="min-w-[180px] flex-1">
                <label htmlFor="committee-del-name" className="label">
                  Delegate name
                </label>
                <input
                  id="committee-del-name"
                  list="committee-delegate-options"
                  value={delName}
                  onChange={(e) => setDelName(e.target.value)}
                  placeholder="Select or type a name"
                  className="input-field !py-2.5"
                />
                <datalist id="committee-delegate-options">
                  {delegateSuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="min-w-[160px] flex-1">
                <label htmlFor="committee-del-portfolio" className="label">
                  Portfolio / country
                </label>
                <input
                  id="committee-del-portfolio"
                  value={delPortfolio}
                  onChange={(e) => setDelPortfolio(e.target.value)}
                  placeholder="e.g. France (optional)"
                  className="input-field !py-2.5"
                />
              </div>
              <button
                type="submit"
                disabled={!delName.trim()}
                className="btn-gold !py-2.5"
              >
                <PlusIcon width={16} height={16} /> Add delegate
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
