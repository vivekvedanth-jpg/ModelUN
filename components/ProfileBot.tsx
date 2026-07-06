"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAccounts, type AccountDetail } from "@/lib/auth";
import {
  getAllExperiences,
  AWARD_PLACEMENTS,
  isAward,
  type MunExperience,
} from "@/lib/experience";
import {
  getRankingSettings,
  scoreForExperiences,
  awardLabel,
  DEFAULT_POINTS,
} from "@/lib/ranking";
import { SparkleIcon } from "./icons";

interface Message {
  from: "bot" | "you";
  text: string;
}

const GREETING =
  "Hi! I'm the Delegate Lookup bot. Type a delegate's email or first name for their full profile, experience, and awards. Ask \"how many awards does <name> have\" for a quick award count. Try \"list\" to see everyone, or \"help\".";

const STOPWORDS = new Set([
  "tell", "me", "about", "show", "who", "is", "the", "delegate", "profile",
  "of", "find", "look", "up", "for", "email", "name", "whats", "what", "give",
  "info", "on", "details", "search",
]);

/** Extra words to strip when the query is specifically about awards. */
const AWARD_WORDS = new Set([
  "award", "awards", "how", "many", "does", "do", "did", "have", "has", "had",
  "won", "win", "wins", "get", "got", "gotten", "earn", "earned", "and",
]);

function nameOf(a: AccountDetail): string {
  return a.profile.fullName?.trim() || a.email.split("@")[0];
}

function firstNameOf(a: AccountDetail): string {
  return (a.profile.fullName?.trim().split(/\s+/)[0] || a.email.split("@")[0]).toLowerCase();
}

function extractTerm(input: string, extra?: Set<string>): string {
  const emailMatch = input.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) return emailMatch[0].toLowerCase();
  return input
    .toLowerCase()
    .replace(/[^\w@.\s+-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && !(extra && extra.has(w)))
    .join(" ")
    .trim();
}

/** A delegate's experiences, newest first. */
function experiencesFor(a: AccountDetail, experiences: MunExperience[]): MunExperience[] {
  return experiences
    .filter((e) => e.owner.toLowerCase() === a.email.toLowerCase())
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

/** A "Conference 2025" label, avoiding a duplicated year. */
function whereLabel(e: MunExperience): string {
  const year = /^\d{4}/.test(e.date) ? e.date.slice(0, 4) : "";
  if (year && !e.conference.includes(year)) return `${e.conference} ${year}`;
  return e.conference;
}

/**
 * Groups a delegate's award-winning experiences by placement, preserving the
 * canonical PLACEMENTS ordering (Best Delegate first).
 */
function awardGroups(
  mine: MunExperience[]
): { placement: string; wins: MunExperience[] }[] {
  const groups: { placement: string; wins: MunExperience[] }[] = [];
  for (const placement of AWARD_PLACEMENTS) {
    const wins = mine.filter((e) => e.placement === placement);
    if (wins.length > 0) groups.push({ placement, wins });
  }
  return groups;
}

function awardLines(mine: MunExperience[], names: Record<string, string>): string[] {
  const groups = awardGroups(mine);
  return groups.map(
    (g) =>
      `   ${awardLabel(g.placement, names)} ×${g.wins.length} — ${g.wins
        .map(whereLabel)
        .join(", ")}`
  );
}

function summarize(
  a: AccountDetail,
  experiences: MunExperience[],
  points: Record<string, number>,
  names: Record<string, string>
): string {
  const mine = experiencesFor(a, experiences);
  const score = scoreForExperiences(mine, points);
  const roleLabel =
    a.role === "owner" ? "Owner" :
    a.role === "admin" ? "Admin" :
    a.role === "chair" ? "Chair" :
    a.role === "guest" ? "Guest" : "Delegate";

  const lines = [`📋 ${nameOf(a)} — ${roleLabel}`, `Email: ${a.email}`];
  const classBits = [a.profile.className && `Class ${a.profile.className}`, a.profile.section && `Section ${a.profile.section}`]
    .filter(Boolean).join(" · ");
  if (classBits) lines.push(classBits);
  if (a.profile.phone) lines.push(`Phone: ${a.profile.phone}`);
  lines.push("");

  const awards = mine.filter((e) => isAward(e.placement));
  lines.push(`Conferences: ${mine.length}   ·   Total score: ${score} pts   ·   🏆 Awards: ${awards.length}`);

  if (awards.length > 0) {
    lines.push("");
    lines.push(...awardLines(mine, names));
  }

  if (mine.length > 0) {
    lines.push("");
    lines.push("All conferences:");
    for (const e of mine) {
      lines.push(
        `• ${e.conference} (${e.date}) — ${e.committee}, ${e.portfolio} → ${awardLabel(e.placement, names)}`
      );
    }
  } else {
    lines.push("No conferences logged yet.");
  }
  return lines.join("\n");
}

/** Focused answer for "how many awards does X have". */
function summarizeAwards(
  a: AccountDetail,
  experiences: MunExperience[],
  names: Record<string, string>
): string {
  const mine = experiencesFor(a, experiences);
  const awards = mine.filter((e) => isAward(e.placement));
  if (awards.length === 0) {
    return `🏆 ${nameOf(a)} has no awards yet — ${mine.length} ${mine.length === 1 ? "conference" : "conferences"} logged.`;
  }
  const lines = [
    `🏆 ${nameOf(a)} has ${awards.length} ${awards.length === 1 ? "award" : "awards"} across ${mine.length} ${mine.length === 1 ? "conference" : "conferences"}:`,
    ...awardLines(mine, names),
  ];
  return lines.join("\n");
}

export default function ProfileBot() {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [experiences, setExperiences] = useState<MunExperience[]>([]);
  const [points, setPoints] = useState<Record<string, number>>(DEFAULT_POINTS);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getAccounts(),
      getAllExperiences(),
      getRankingSettings(),
    ])
      .then(([accts, exps, settings]) => {
        setAccounts(accts);
        setExperiences(exps);
        setPoints(settings.points);
        setNames(settings.awardNames);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /** Find one account: exact email wins outright, then substring / first-name. */
  function findAccounts(term: string): AccountDetail[] {
    const exact = accounts.find((a) => a.email.toLowerCase() === term);
    if (exact) return [exact];
    return accounts.filter(
      (a) =>
        a.email.toLowerCase().includes(term) ||
        nameOf(a).toLowerCase().includes(term) ||
        firstNameOf(a) === term
    );
  }

  function reply(query: string): string {
    const raw = query.trim().toLowerCase();

    if (loadError) {
      return "I couldn't load the delegate data. Please refresh the page and try again.";
    }
    if (!raw) return "Type a delegate's email or first name.";
    if (raw === "help") {
      return "Search by email (jane@school.edu) or first name (jane) for a full profile with awards. Ask \"how many awards does jane have\" (or \"awards jane\") for just the award count. Commands: \"list\" shows all accounts; \"admins\" shows admins only.";
    }
    if (raw === "list" || raw === "all") {
      if (accounts.length === 0) return "There are no accounts yet.";
      return "All accounts:\n" + accounts.map((a) => `• ${nameOf(a)} — ${a.email} (${a.role})`).join("\n");
    }
    if (raw === "admins") {
      const admins = accounts.filter((a) => a.role !== "normal" && a.role !== "guest");
      if (admins.length === 0) return "No admins found.";
      return "Admins & Owner:\n" + admins.map((a) => `• ${nameOf(a)} — ${a.email} (${a.role})`).join("\n");
    }

    // Is this specifically an award question?
    const isAwardQuery = /\baward/.test(raw);
    const term = extractTerm(query, isAwardQuery ? AWARD_WORDS : undefined);
    if (!term) {
      return isAwardQuery
        ? "Whose awards? Add a name or email, e.g. \"awards jane\"."
        : "I couldn't find a name or email in that. Try just the first name or email.";
    }

    const matches = findAccounts(term);
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
    return isAwardQuery
      ? summarizeAwards(matches[0], experiences, names)
      : summarize(matches[0], experiences, points, names);
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
          <div className="text-xs text-navy-500">Search profiles, experience &amp; awards</div>
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
            placeholder="Email, first name, or “awards jane”…"
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
