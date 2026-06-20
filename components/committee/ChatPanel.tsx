"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  sendCommitteeMessage,
  clearCommitteeMessages,
  type Committee,
} from "@/lib/committee";
import { ChatIcon, TrashIcon, LockIcon } from "../icons";

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const messages = committee.messages ?? [];

  // Who you can address. Chair is a target for delegates; delegates are targets for everyone.
  const recipients = useMemo(() => {
    const out: { value: string; label: string }[] = [{ value: "", label: "Everyone" }];
    if (!canManage && committee.chair.toLowerCase() !== me) {
      out.push({ value: committee.chair.toLowerCase(), label: "Chair" });
    }
    for (const d of committee.delegates) {
      if (d.email && d.email.toLowerCase() !== me) {
        out.push({ value: d.email.toLowerCase(), label: d.name });
      }
    }
    return out;
  }, [committee, me, canManage]);

  function nameFor(email: string): string {
    if (email.toLowerCase() === committee.chair.toLowerCase()) return "Chair";
    const d = committee.delegates.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase());
    return d?.name ?? email.split("@")[0];
  }

  // Keep the latest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const u = await sendCommitteeMessage(committee.id, text, to || undefined);
      onUpdate(u);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
    } finally {
      setBusy(false);
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

      <div ref={listRef} className="max-h-80 min-h-[8rem] space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-navy-400">
            No messages yet. Ask a question or send a note to the chair.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorEmail.toLowerCase() === me;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-navy-800 text-white" : "bg-navy-50 text-navy-900"}`}>
                  <div className={`mb-0.5 flex items-center gap-1.5 text-xs ${mine ? "text-navy-200" : "text-navy-500"}`}>
                    <span className="font-semibold">{mine ? "You" : m.authorName}</span>
                    {m.toEmail && (
                      <span className="inline-flex items-center gap-0.5">
                        <LockIcon width={10} height={10} /> to {nameFor(m.toEmail)}
                      </span>
                    )}
                    <span>· {timeOf(m.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex flex-wrap items-center gap-2 border-t border-navy-100 p-3">
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Send to"
          className="input-field !w-auto !py-2 text-sm"
        >
          {recipients.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value === "" ? "📢 Everyone" : `🔒 ${r.label}`}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={1000}
          className="input-field !py-2 min-w-[8rem] flex-1"
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary !py-2">
          Send
        </button>
      </form>
      {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
