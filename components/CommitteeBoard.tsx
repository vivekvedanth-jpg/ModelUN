"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { isOwner } from "@/lib/auth";
import {
  getCommitteesForUser,
  getRoster,
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
  type RosterAccount,
} from "@/lib/committee";
import SessionBanner from "./committee/SessionBanner";
import VotePanel from "./committee/VotePanel";
import ChatPanel from "./committee/ChatPanel";
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
  const [error, setError] = useState("");

  const [delName, setDelName] = useState("");
  const [delPortfolio, setDelPortfolio] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [roster, setRoster] = useState<RosterAccount[]>([]);
  const [acctEmail, setAcctEmail] = useState("");
  const [acctPortfolio, setAcctPortfolio] = useState("");
  const [acctSearch, setAcctSearch] = useState("");
  const [acctDropOpen, setAcctDropOpen] = useState(false);

  // Local drafts for the committee name/conference so typing never races the
  // server (the previous version saved on every keystroke and dropped letters).
  const [nameDraft, setNameDraft] = useState("");
  const [confDraft, setConfDraft] = useState("");
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = useMemo(
    () => committees.find((c) => c.id === activeId) ?? null,
    [committees, activeId]
  );

  // Latest committees, readable inside the polling loop without re-subscribing.
  const committeesRef = useRef<Committee[]>([]);
  committeesRef.current = committees;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Self-scheduling poll: chairs see votes/chat live. Speeds up to 2s while a
    // vote is open so a delegate's ballot shows in the count almost instantly.
    // Editable fields (name/conference drafts, score inputs) are local/
    // uncontrolled, so a refresh won't clobber anything the chair is typing.
    const tick = () => {
      getCommitteesForUser()
        .then((list) => {
          if (cancelled) return;
          setCommittees(list);
          setActiveId((cur) =>
            cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null
          );
        })
        .catch(() => {})
        .finally(() => {
          if (cancelled) return;
          const live = committeesRef.current.some((c) => c.vote && !c.vote.closed);
          timer = setTimeout(tick, live ? 2000 : 5000);
        });
    };
    tick();
    getRoster().then(setRoster).catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user]);

  // Reset the name/conference drafts only when switching committees.
  useEffect(() => {
    setNameDraft(active?.name ?? "");
    setConfDraft(active?.conference ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const applyUpdate = (u: Committee) =>
    setCommittees((prev) => prev.map((c) => (c.id === u.id ? u : c)));

  function onNameChange(v: string) {
    setNameDraft(v);
    if (!active) return;
    const cid = active.id;
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => { edit(() => renameCommittee(cid, { name: v })); }, 500);
  }

  function onConfChange(v: string) {
    setConfDraft(v);
    if (!active) return;
    const cid = active.id;
    if (confTimer.current) clearTimeout(confTimer.current);
    confTimer.current = setTimeout(() => { edit(() => renameCommittee(cid, { conference: v })); }, 500);
  }

  const availableAccounts = useMemo(
    () =>
      roster.filter(
        (a) => !active?.delegates.some((d) => d.email && d.email.toLowerCase() === a.email.toLowerCase())
      ),
    [roster, active]
  );

  async function handleAddAccount() {
    if (!active || !acctEmail) return;
    const acct = roster.find((a) => a.email === acctEmail);
    await edit(() => addDelegate(active.id, { email: acctEmail, name: acct?.name, portfolio: acctPortfolio }));
    setAcctEmail("");
    setAcctSearch("");
    setAcctPortfolio("");
  }

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.toLowerCase();
    if (!q) return availableAccounts;
    return availableAccounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [availableAccounts, acctSearch]);

  /** Runs an async committee mutation and folds the updated committee back in. */
  async function edit(fn: () => Promise<Committee>) {
    setError("");
    try {
      const updated = await fn();
      setCommittees((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleCreate() {
    setError("");
    try {
      const c = await createCommittee();
      setCommittees((prev) => [c, ...prev]);
      setActiveId(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleDelete() {
    if (!active) return;
    if (!window.confirm(`Delete the committee "${active.name}" and all its scores? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteCommittee(active.id);
      const list = await getCommitteesForUser();
      setCommittees(list);
      setActiveId(list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleAddDelegate(e: FormEvent) {
    e.preventDefault();
    if (!active || !delName.trim()) return;
    await edit(() => addDelegate(active.id, { name: delName, portfolio: delPortfolio }));
    setDelName("");
    setDelPortfolio("");
  }

  async function handleAddSpeaker(e: FormEvent) {
    e.preventDefault();
    if (!active || !speakerName.trim()) return;
    await edit(() => addSpeaker(active.id, speakerName));
    setSpeakerName("");
  }

  const speakerSuggestions = useMemo(() => {
    if (!active) return [];
    const set = new Set<string>();
    for (const d of active.delegates) {
      if (d.portfolio) set.add(d.portfolio);
      if (d.name) set.add(d.name);
    }
    return Array.from(set);
  }, [active]);

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
                  value={nameDraft}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Committee name (e.g. UNSC)"
                  className="w-full bg-transparent font-serif text-2xl font-bold text-navy-900 outline-none placeholder:text-silver-500"
                />
                <input
                  value={confDraft}
                  onChange={(e) => onConfChange(e.target.value)}
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

          {/* Session status */}
          <SessionBanner committee={active} canManage onUpdate={applyUpdate} />

          {/* Voting + chat */}
          <div className="grid gap-6 lg:grid-cols-2">
            <VotePanel committee={active} canManage onUpdate={applyUpdate} />
            <ChatPanel
              committee={active}
              meEmail={user?.email ?? ""}
              canManage
              onUpdate={applyUpdate}
            />
          </div>

          {/* Speaker list */}
          <div>
            <h2 className="text-xl font-bold text-navy-900">Speaker list</h2>
            <p className="mt-1 text-sm text-navy-600">
              Add countries in speaking order. Delegates see this live on their
              Committee page.
            </p>

            <form onSubmit={handleAddSpeaker} className="mt-4 flex flex-wrap items-center gap-2">
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
              <button type="submit" disabled={!speakerName.trim()} className="btn-primary !py-2.5">
                <PlusIcon width={16} height={16} /> Add
              </button>
              {active.speakers.length > 0 && (
                <button
                  type="button"
                  onClick={() => { if (window.confirm("Clear the whole speaker list?")) edit(() => clearSpeakers(active.id)); }}
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
                        className={`flex items-center gap-3 px-4 py-2.5 ${current ? "bg-emerald-50" : s.done ? "bg-navy-50/40" : ""}`}
                      >
                        <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-navy-500">{i + 1}</span>
                        <span className={`min-w-0 flex-1 truncate font-semibold ${s.done && !current ? "text-navy-400 line-through" : "text-navy-900"}`}>
                          {s.name}
                        </span>
                        {current && <span className="badge bg-emerald-500 text-white">Speaking</span>}
                        {s.done && !current && <span className="badge bg-navy-100 text-navy-600">Done</span>}
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button onClick={() => edit(() => setCurrentSpeaker(active.id, current ? null : s.id))} title={current ? "Stop speaking" : "Set as speaking"} aria-label="Set as speaking" className={`rounded-lg border p-1.5 ${current ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-navy-200 text-navy-600 hover:bg-navy-50"}`}>
                            <MicIcon width={14} height={14} />
                          </button>
                          <button onClick={() => edit(() => toggleSpeakerDone(active.id, s.id))} title="Mark done" aria-label="Mark done" className={`rounded-lg border p-1.5 ${s.done ? "border-navy-300 bg-navy-100 text-navy-700" : "border-navy-200 text-navy-600 hover:bg-navy-50"}`}>
                            <CheckIcon width={14} height={14} />
                          </button>
                          <button onClick={() => edit(() => moveSpeaker(active.id, s.id, -1))} disabled={i === 0} aria-label="Move up" className="rounded-lg border border-navy-200 p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30">
                            <ArrowUpIcon width={14} height={14} />
                          </button>
                          <button onClick={() => edit(() => moveSpeaker(active.id, s.id, 1))} disabled={i === active.speakers.length - 1} aria-label="Move down" className="rounded-lg border border-navy-200 p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30">
                            <ArrowDownIcon width={14} height={14} />
                          </button>
                          <button onClick={() => edit(() => removeSpeaker(active.id, s.id))} aria-label="Remove speaker" className="rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600">
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

          {/* Standings */}
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
                onClick={() => edit(() => setPublished(active.id, !active.published))}
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
                    <li key={d.id} className={`flex items-center gap-3 px-5 py-3 ${i < 3 ? "bg-gold-50/50" : ""}`}>
                      <span className="w-8 flex-shrink-0 text-center text-lg font-bold text-navy-900">{medal(i)}</span>
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                        {(d.portfolio || d.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-navy-900">{d.portfolio || d.name}</div>
                        {d.portfolio && <div className="truncate text-xs text-navy-500">{d.name}</div>}
                      </div>
                      <span className="badge bg-gold-100 text-gold-700">{total} pts</span>
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
              <button onClick={() => edit(() => addColumn(active.id))} className="btn-ghost !px-4 !py-2 text-sm">
                <PlusIcon width={16} height={16} /> Add category
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-navy-50 text-navy-600">
                  <tr>
                    <th className="sticky left-0 z-10 bg-navy-50 px-4 py-3 font-semibold">Delegate</th>
                    {active.columns.map((col) => (
                      <th key={col.id} className="px-2 py-2 font-semibold">
                        <div className="group flex items-center justify-center gap-0.5">
                          <input
                            key={col.id}
                            defaultValue={col.label}
                            onBlur={(e) => { if (e.target.value !== col.label) edit(() => renameColumn(active.id, col.id, e.target.value)); }}
                            aria-label="Category name"
                            className="w-24 rounded-md bg-transparent px-1.5 py-1 text-center text-xs font-bold uppercase tracking-wide text-navy-700 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-300"
                          />
                          <button
                            onClick={() => { if (window.confirm(`Remove the "${col.label}" category from every delegate?`)) edit(() => removeColumn(active.id, col.id)); }}
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
                      <td colSpan={active.columns.length + 3} className="px-4 py-8 text-center text-sm text-navy-500">
                        No delegates yet — add your committee&apos;s delegates below.
                      </td>
                    </tr>
                  ) : (
                    active.delegates.map((d) => (
                      <tr key={d.id} className="hover:bg-navy-50/40">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-navy-900">{d.portfolio || d.name}</span>
                            {!d.email && (
                              <span className="badge bg-navy-100 px-1.5 py-0.5 text-[10px] text-navy-500" title="No linked account — can't vote or chat">
                                no login
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-navy-500">{d.portfolio ? d.name : ""}</div>
                        </td>
                        {active.columns.map((col) => (
                          <td key={col.id} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              defaultValue={d.scores[col.id] ?? ""}
                              onChange={(e) => edit(() => setScore(active.id, d.id, col.id, e.target.value === "" ? null : Number(e.target.value)))}
                              aria-label={`${d.name} — ${col.label}`}
                              placeholder="0"
                              className="no-spin w-16 rounded-lg border border-navy-200 px-2 py-1.5 text-center text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/30"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center">
                          <span className="badge bg-gold-100 text-gold-700">{totalFor(active, d)}</span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            onClick={() => { if (window.confirm(`Remove ${d.name} from this committee?`)) edit(() => removeDelegate(active.id, d.id)); }}
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
            <div className="mt-4 space-y-3 rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/40 p-4">
              {/* Primary: add an existing delegate account (these can vote & chat) */}
              <div>
                <span className="label">Add a delegate from their account</span>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="relative min-w-[200px] flex-1">
                    {acctEmail ? (
                      <div className="flex items-center gap-2 rounded-xl border border-navy-300 bg-white px-3 py-2.5 text-sm">
                        <span className="flex-1 font-medium text-navy-900">
                          {roster.find((a) => a.email === acctEmail)?.name ?? acctEmail}
                          <span className="ml-1.5 text-xs text-navy-500">({acctEmail})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setAcctEmail(""); setAcctSearch(""); }}
                          className="text-navy-400 hover:text-red-600"
                          aria-label="Clear selection"
                        >
                          <CloseIcon width={14} height={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={acctSearch}
                          onChange={(e) => { setAcctSearch(e.target.value); setAcctDropOpen(true); }}
                          onFocus={() => setAcctDropOpen(true)}
                          onBlur={() => setTimeout(() => setAcctDropOpen(false), 150)}
                          placeholder={availableAccounts.length ? "Search by name or email…" : "No accounts available to add"}
                          disabled={!availableAccounts.length}
                          aria-label="Delegate account search"
                          className="input-field !py-2.5"
                        />
                        {acctDropOpen && filteredAccounts.length > 0 && (
                          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-lg">
                            {filteredAccounts.map((a) => (
                              <li key={a.email}>
                                <button
                                  type="button"
                                  onMouseDown={() => { setAcctEmail(a.email); setAcctSearch(""); setAcctDropOpen(false); }}
                                  className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-navy-50"
                                >
                                  <span className="font-medium text-navy-900">{a.name}</span>
                                  <span className="text-xs text-navy-500">{a.email}{a.role !== "normal" ? ` · ${a.role}` : ""}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                  <div className="min-w-[150px] flex-1">
                    <input
                      value={acctPortfolio}
                      onChange={(e) => setAcctPortfolio(e.target.value)}
                      placeholder="Portfolio / country (optional)"
                      aria-label="Portfolio for account delegate"
                      className="input-field !py-2.5"
                    />
                  </div>
                  <button onClick={handleAddAccount} disabled={!acctEmail} className="btn-gold !py-2.5">
                    <PlusIcon width={16} height={16} /> Add delegate
                  </button>
                </div>
                <p className="mt-1 text-xs text-navy-500">
                  Delegates must have an account first (create them in Admin). Only added delegates can join, vote and chat.
                </p>
              </div>

              {/* Secondary: a scoring-only entry with no login */}
              <form onSubmit={handleAddDelegate} className="flex flex-wrap items-end gap-3 border-t border-navy-200/70 pt-3">
                <div className="min-w-[180px] flex-1">
                  <label htmlFor="committee-del-name" className="label">…or add a name to score only (no login)</label>
                  <input
                    id="committee-del-name"
                    value={delName}
                    onChange={(e) => setDelName(e.target.value)}
                    placeholder="Delegate name"
                    className="input-field !py-2.5"
                  />
                </div>
                <div className="min-w-[150px] flex-1">
                  <input
                    id="committee-del-portfolio"
                    value={delPortfolio}
                    onChange={(e) => setDelPortfolio(e.target.value)}
                    placeholder="e.g. France (optional)"
                    aria-label="Portfolio"
                    className="input-field !py-2.5"
                  />
                </div>
                <button type="submit" disabled={!delName.trim()} className="btn-ghost !py-2.5">
                  <PlusIcon width={16} height={16} /> Add name
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
