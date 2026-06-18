"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getVisibleAccounts, type AccountDetail } from "@/lib/auth";
import { getAllExperiences, type MunExperience } from "@/lib/experience";
import { useAuth } from "./AuthProvider";
import { getPointsMap, scoreForExperiences } from "@/lib/ranking";
import { SparkleIcon } from "./icons";

interface Message {
  from: "bot" | "you";
  text: string;
}

const GREETING =
  "Hi! I'm the Delegate Lookup bot. Type a delegate's email or first name and I'll pull up their profile, experience, and score. Try \"list\" to see everyone, or \"help\".";

const STOPWORDS = new Set([
  "tell", "me", "about", "show", "who", "is", "the", "delegate", "profile",
  "of", "find", "look", "up", "for", "email", "name", "whats", "what", "give",
  "info", "on", "details", "search",
]);

function nameOf(a: AccountDetail): string {
  return a.profile.fullName?.trim() || a.email.split("@")[0];
}

function firstNameOf(a: AccountDetail): string {
  return (a.profile.fullName?.trim().split(/\s+/)[0] || a.email.split("@")[0]).toLowerCase();
}

/** Pulls the most likely search term out of a natural-language query. */
function extractTerm(input: string): string {
  const emailMatch = input.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) return emailMatch[0].toLowerCase();
  return input
    .toLowerCase()
    .replace(/[^\w@.\s+-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

function summarize(
  a: AccountDetail,
  experiences: MunExperience[],
  points: Record<string, number>
): string {
  const mine = experiences
    .filter((e) => e.owner.toLowerCase() === a.email.toLowerCase())
    .sort((x, y) => (x.date < y.date ? 1 : -1));
  const score = scoreForExperiences(mine, points);
  const roleLabel =
    a.role === "owner"
      ? "Owner"
      : a.role === "admin"
      ? "Admin"
      : a.role === "chair"
      ? "Chair"
      : "Delegate";

  const lines = [
    `📋 ${nameOf(a)} — ${roleLabel}`,
    `Email: ${a.email}`,
  ];
  const classBits = [a.profile.className && `Class ${a.profile.className}`, a.profile.section && `Section ${a.profile.section}`]
    .filter(Boolean)
    .join(" · ");
  if (classBits) lines.push(classBits);
  if (a.profile.phone) lines.push(`Phone: ${a.profile.phone}`);
  lines.push("");
  lines.push(`Conferences: ${mine.length}   ·   Total score: ${score} pts`);

  if (mine.length > 0) {
    lines.push("");
    for (const e of mine) {
      lines.push(`• ${e.conference} (${e.date}) — ${e.committee}, ${e.portfolio} → ${e.placement}`);
    }
  } else {
    lines.push("No conferences logged yet.");
  }
  return lines.join("\n");
}

export default function ProfileBot() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [experiences, setExperiences] = useState<MunExperience[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ from: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccounts(getVisibleAccounts(user));
    setExperiences(getAllExperiences());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function reply(query: string): string {
    const points = getPointsMap();
    const raw = query.trim().toLowerCase();

    if (!raw) return "Type a delegate's email or first name.";
    if (raw === "help") {
      return "Search by email (jane@school.edu) or first name (jane). Commands: \"list\" shows all accounts; \"admins\" shows admins only.";
    }
    if (raw === "list" || raw === "all") {
      if (accounts.length === 0) return "There are no accounts yet.";
      return "All accounts:\n" + accounts.map((a) => `• ${nameOf(a)} — ${a.email} (${a.role})`).join("\n");
    }
    if (raw === "admins") {
      const admins = accounts.filter((a) => a.role !== "normal");
      return "Admins & Owner:\n" + admins.map((a) => `• ${nameOf(a)} — ${a.email} (${a.role})`).join("\n");
    }

    const term = extractTerm(query);
    if (!term) return "I couldn't find a name or email in that. Try just the first name or email.";

    const matches = accounts.filter(
      (a) =>
        a.email.toLowerCase().includes(term) ||
        nameOf(a).toLowerCase().includes(term) ||
        firstNameOf(a) === term
    );

    if (matches.length === 0) {
      return `No delegate found matching "${term}". Try "list" to see everyone.`;
    }
    if (matches.length > 1) {
      return (
        `I found ${matches.length} matches for "${term}":\n` +
        matches.map((a) => `• ${nameOf(a)} — ${a.email}`).join("\n") +
        "\n\nReply with the exact email to see a full profile."
      );
    }
    return summarize(matches[0], experiences, points);
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setMessages((prev) => [...prev, { from: "you", text: clean }, { from: "bot", text: reply(clean) }]);
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="card flex h-[30rem] flex-col overflow-hidden !p-0">
      <div className="flex items-center gap-3 border-b border-navy-100 bg-navy-50 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
          <SparkleIcon />
        </span>
        <div>
          <div className="font-bold text-navy-900">Delegate Lookup</div>
          <div className="text-xs text-navy-500">Search profiles by email or name · offline</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.from === "you"
                  ? "rounded-br-sm bg-navy-800 text-white"
                  : "rounded-bl-sm bg-navy-50 text-navy-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-navy-100 p-4">
        <div className="flex items-center gap-2 rounded-full border border-navy-200 bg-white px-4 py-2.5 focus-within:border-navy-500">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Email or first name…"
            className="flex-1 bg-transparent text-sm text-navy-900 outline-none placeholder:text-silver-500"
          />
          <button type="submit" disabled={!input.trim()} className="btn-gold !px-4 !py-2 text-sm">
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
