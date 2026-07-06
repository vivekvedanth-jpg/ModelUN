"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  sendCommitteeMessage,
  clearCommitteeMessages,
  deleteCommitteeMessage,
  reactToMessage,
  REACTION_EMOJI,
  type Committee,
  type CommitteeMessage,
} from "@/lib/committee";
import { ChatIcon, TrashIcon, LockIcon, CloseIcon } from "../icons";

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** Messages within this gap from the same author (same target) are grouped. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export default function ChatPanel({
  committee,
  meEmail,
  canManage,
  onUpdate,
}: {
  committee: Committee;
  meEmail: string;
  canManage: boolean;
  onUpdate: (c: Committee) => void;
}) {
  const me = meEmail.toLowerCase();
  const [text, setText] = useState("");
  const [to, setTo] = useState(""); // "" = everyone
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [hasNew, setHasNew] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);

  const messages = useMemo(() => committee.messages ?? [], [committee.messages]);

  // Who you can address: Everyone, the chair (unless you ARE the chair — this
  // now includes admins/owner viewing another chair's committee), and every
  // linked delegate other than yourself.
  const recipients = useMemo(() => {
    const out: { value: string; label: string }[] = [{ value: "", label: "Everyone" }];
    if (committee.chair.toLowerCase() !== me) {
      out.push({ value: committee.chair.toLowerCase(), label: "Chair" });
    }
    for (const d of committee.delegates) {
      if (d.email && d.email.toLowerCase() !== me) {
        out.push({ value: d.email.toLowerCase(), label: d.name });
      }
    }
    return out;
  }, [committee, me]);

  // If the currently-selected recipient disappears (delegate removed), reset.
  useEffect(() => {
    if (to && !recipients.some((r) => r.value === to)) setTo("");
  }, [recipients, to]);

  function nameFor(email: string): string {
    if (email.toLowerCase() === committee.chair.toLowerCase()) return "Chair";
    const d = committee.delegates.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase());
    return d?.name ?? email.split("@")[0];
  }

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    if (nearBottom) setHasNew(false);
  }

  function scrollToBottom(smooth = true) {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setHasNew(false);
  }

  // Auto-stick to the bottom only when the viewer is already there (or the new
  // message is their own); otherwise surface a "new messages" pill.
  useLayoutEffect(() => {
    const grew = messages.length > prevLenRef.current;
    const last = messages[messages.length - 1];
    const mineLast = last && last.authorEmail.toLowerCase() === me;
    if (grew) {
      if (atBottomRef.current || mineLast) scrollToBottom(true);
      else setHasNew(true);
    }
    prevLenRef.current = messages.length;
  }, [messages, me]);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const u = await sendCommitteeMessage(
        committee.id,
        text,
        to || undefined,
        announce && canManage && !to ? true : undefined
      );
      onUpdate(u);
      setText("");
      requestAnimationFrame(() => {
        autoGrow();
        scrollToBottom(true);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  async function react(messageId: string, emoji: string) {
    setReactingId(null);
    try {
      onUpdate(await reactToMessage(committee.id, messageId, emoji));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't react.");
    }
  }

  async function remove(m: CommitteeMessage) {
    if (!window.confirm("Delete this message?")) return;
    try {
      onUpdate(await deleteCommitteeMessage(committee.id, m.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  }

  async function erase() {
    if (!window.confirm("Erase the entire committee chat for everyone? This permanently deletes all messages.")) return;
    setBusy(true);
    setError("");
    try {
      onUpdate(await clearCommitteeMessages(committee.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't erase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-navy-100 bg-white">
      <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
        <h3 className="flex items-center gap-2 font-bold text-navy-900">
          <ChatIcon width={18} height={18} /> Committee chat
        </h3>
        {canManage && messages.length > 0 && (
          <button onClick={erase} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
            <TrashIcon width={13} height={13} /> Erase chat
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="max-h-80 min-h-[10rem] space-y-1 overflow-y-auto px-4 py-3"
        >
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-navy-400">
              No messages yet. Ask a question or send a note to the chair.
            </p>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const mine = m.authorEmail.toLowerCase() === me;
              const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const grouped =
                !!prev &&
                !newDay &&
                !m.announcement &&
                !prev.announcement &&
                prev.authorEmail.toLowerCase() === m.authorEmail.toLowerCase() &&
                (prev.toEmail ?? "") === (m.toEmail ?? "") &&
                m.createdAt - prev.createdAt <= GROUP_WINDOW_MS;
              const showHeader = !grouped;

              // Fold reactions into { emoji -> {count, mine} }.
              const reactions = m.reactions ?? [];
              const groupedReactions = REACTION_EMOJI.map((emoji) => {
                const hits = reactions.filter((r) => r.emoji === emoji);
                return {
                  emoji,
                  count: hits.length,
                  mine: hits.some((r) => r.email.toLowerCase() === me),
                };
              }).filter((r) => r.count > 0);

              const canDelete = mine || canManage;

              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-3 flex items-center gap-3">
                      <span className="h-px flex-1 bg-navy-100" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                        {dayLabel(m.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-navy-100" />
                    </div>
                  )}

                  {m.announcement ? (
                    /* Announcement — full-width gold banner */
                    <div className="group relative my-2 rounded-xl border border-gold-300 bg-gold-50 px-4 py-2.5">
                      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-gold-700">
                        📣 Announcement · {m.authorName}
                        <span className="font-normal text-gold-600">· {timeOf(m.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm text-navy-900">{m.text}</div>
                      {canDelete && (
                        <button
                          onClick={() => remove(m)}
                          aria-label="Delete announcement"
                          className="absolute right-1.5 top-1.5 rounded p-1 text-gold-600/60 opacity-0 hover:bg-gold-100 hover:text-red-600 group-hover:opacity-100"
                        >
                          <CloseIcon width={13} height={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      <div className="relative max-w-[85%]">
                        <div className={`rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-navy-800 text-white" : "bg-navy-50 text-navy-900"}`}>
                          {showHeader && (
                            <div className={`mb-0.5 flex flex-wrap items-center gap-1.5 text-xs ${mine ? "text-navy-200" : "text-navy-500"}`}>
                              <span className="font-semibold">{mine ? "You" : m.authorName}</span>
                              {m.toEmail && (
                                <span className="inline-flex items-center gap-0.5">
                                  <LockIcon width={10} height={10} /> to {nameFor(m.toEmail)}
                                </span>
                              )}
                              <span>· {timeOf(m.createdAt)}</span>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        </div>

                        {/* Hover actions: react + delete. Anchored to the bubble's
                            top-right corner so they never overflow the column. */}
                        <div className="absolute -top-2.5 right-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            onClick={() => setReactingId((cur) => (cur === m.id ? null : m.id))}
                            aria-label="Add reaction"
                            className="rounded-full border border-navy-200 bg-white p-1 text-navy-500 shadow-sm hover:bg-navy-50"
                          >
                            <span className="text-xs leading-none">😊</span>
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => remove(m)}
                              aria-label="Delete message"
                              className="rounded-full border border-navy-200 bg-white p-1 text-navy-400 shadow-sm hover:bg-red-50 hover:text-red-600"
                            >
                              <CloseIcon width={12} height={12} />
                            </button>
                          )}
                        </div>

                        {/* Emoji picker popover */}
                        {reactingId === m.id && (
                          <div className={`absolute z-20 mt-1 flex gap-0.5 rounded-full border border-navy-200 bg-white p-1 shadow-lg ${mine ? "right-0" : "left-0"}`}>
                            {REACTION_EMOJI.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => react(m.id, emoji)}
                                className="rounded-full px-1.5 py-0.5 text-base hover:bg-navy-50"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reaction chips */}
                      {groupedReactions.length > 0 && (
                        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                          {groupedReactions.map((r) => (
                            <button
                              key={r.emoji}
                              onClick={() => react(m.id, r.emoji)}
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                                r.mine
                                  ? "border-navy-400 bg-navy-100 text-navy-800 ring-1 ring-navy-400"
                                  : "border-navy-200 bg-white text-navy-600 hover:bg-navy-50"
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span className="font-semibold">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {hasNew && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-navy-900"
          >
            ↓ New messages
          </button>
        )}
      </div>

      <form onSubmit={send} className="border-t border-navy-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              if (e.target.value) setAnnounce(false);
            }}
            aria-label="Send to"
            className="input-field !w-auto !py-2 text-sm"
          >
            {recipients.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value === "" ? "📢 Everyone" : `🔒 ${r.label}`}
              </option>
            ))}
          </select>

          {canManage && !to && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gold-200 bg-gold-50 px-2.5 py-2 text-xs font-semibold text-gold-700">
              <input
                type="checkbox"
                checked={announce}
                onChange={(e) => setAnnounce(e.target.checked)}
                className="accent-gold-600"
              />
              📣 Announce
            </label>
          )}
        </div>

        <div className="mt-2 flex items-end gap-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={announce && !to ? "Write an announcement…" : "Type a message… (Enter to send, Shift+Enter for a new line)"}
            maxLength={1000}
            className="input-field max-h-[120px] min-h-[2.5rem] flex-1 resize-none !py-2"
          />
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary !py-2">
            Send
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between">
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : (
            <span />
          )}
          {text.length > 850 && (
            <span className={`text-xs ${text.length >= 1000 ? "text-red-600" : "text-navy-400"}`}>
              {text.length}/1000
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
