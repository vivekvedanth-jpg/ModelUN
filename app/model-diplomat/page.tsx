"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import {
  SparkleIcon,
  MicIcon,
  ScaleIcon,
  DocumentIcon,
  ExpandIcon,
  MinimizeIcon,
} from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { isAdmin } from "@/lib/auth";
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_MODEL,
  getAssistantModel,
  setAssistantModel,
  modelLabel,
} from "@/lib/assistant";

interface Message {
  from: "assistant" | "you";
  text: string;
}

const CAPABILITIES = [
  { icon: MicIcon, title: "Generate speeches", body: "Get a full opening or GSL speech written for your country and topic." },
  { icon: ScaleIcon, title: "Points & motions", body: "Draft Points of Order, Points of Information, motions, and amendments." },
  { icon: DocumentIcon, title: "Resolutions & answers", body: "Write resolution clauses and ask any question about rules or strategy." },
];

const SUGGESTIONS = [
  "Generate my opening speech",
  "Draft a Point of Order",
  "Write a Point of Information",
  "Draft an operative clause",
  "Explain a moderated caucus",
];

const GREETING =
  "Hello, delegate! I'm your MUN Assistant. Tell me your country and topic and I'll generate your speech, draft Points of Order or Information, write resolution clauses, or answer any MUN question. What do you need?";

/**
 * Offline fallback used only when the AI service can't be reached. It matches
 * keywords and returns concise MUN guidance so the assistant always responds.
 */
function getReply(input: string): string {
  const text = input.toLowerCase();

  if (/(hello|hi|hey|good (morning|afternoon|evening))/.test(text)) {
    return "Hello, delegate! Which country are you representing, and what topic is your committee debating?";
  }
  if (/(point of order)/.test(text)) {
    return "A Point of Order flags a procedural mistake. Phrase it: \"Point of Order — the delegate believes [rule] was not followed.\" Raise it to the chair, not other delegates.";
  }
  if (/(point of information|poi)/.test(text)) {
    return "A Point of Information is a question to a speaker who has yielded to points. Phrase it: \"Point of Information — does the delegate agree that…?\" Keep it short and pointed.";
  }
  if (/(speech|opening|address)/.test(text)) {
    return "A strong opening speech has four beats: (1) a hook, (2) your country's position in one sentence, (3) two or three supporting points, and (4) a call to action. Tell me your country and topic and I'll generate the full speech.";
  }
  if (/(resolution|operative|preamb|clause|draft)/.test(text)) {
    return "Resolutions have two halves. Preambulatory clauses (e.g. \"Recalling\", \"Noting with concern\") set the context. Operative clauses (e.g. \"Calls upon\", \"Encourages\", \"Decides\") are the numbered actions. Start each operative clause with an action verb and make it specific and measurable. What action do you want your resolution to take?";
  }
  if (/(caucus|moderated|unmoderated)/.test(text)) {
    return "A moderated caucus is structured debate: the chair calls on delegates one at a time for short speeches on a sub-topic. An unmoderated caucus is free discussion where you move around to negotiate and form blocs. Motion for one by stating the topic, total time, and speaking time (e.g. \"10 minutes total, 45 seconds per speaker\").";
  }
  if (/(position paper|policy)/.test(text)) {
    return "A position paper has three parts: (1) the topic background, (2) your country's policy and past actions, and (3) your proposed solutions. Keep it to one page per topic and cite real resolutions or treaties your country has signed. Which topic are you writing about?";
  }
  if (/(country|delegate|represent|deleg)/.test(text)) {
    return "Great — to represent a country well, research its alliances, its voting record at the UN, and its national interests. Then argue from that perspective, not your own. Which country is it? I can suggest likely allies and priorities.";
  }
  if (/(amendment|vote|voting|motion)/.test(text)) {
    return "During voting procedure, amendments are voted on before the full resolution. A friendly amendment (accepted by all sponsors) passes automatically; an unfriendly one is put to a vote. When in doubt, raise a Point of Order or Point of Parliamentary Inquiry to ask the chair.";
  }
  if (/(thank|thanks|great|cool|nice)/.test(text)) {
    return "Anytime, delegate. Ask me anything else — speeches, resolutions, caucuses, or strategy. You've got this!";
  }
  return "Good question. Try framing it around a specific committee task — for example a speech, a resolution clause, a caucus motion, or your position paper — and I'll give you concrete guidance. You can also tap one of the suggestions above.";
}

function MUNAssistant() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const [messages, setMessages] = useState<Message[]>([
    { from: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [model, setModel] = useState(DEFAULT_ASSISTANT_MODEL);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load the saved model choice (admins can change it from the chat header).
  useEffect(() => {
    setModel(getAssistantModel());
  }, []);

  // Keep the conversation scrolled to the latest message (and while thinking).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Lock background scroll while the chat is fullscreen, and allow Esc to exit.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;

    const history = [...messages, { from: "you" as const, text: clean }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) {
        throw new Error(data.error || "The assistant is unavailable.");
      }
      setMessages((prev) => [...prev, { from: "assistant", text: data.text }]);
    } catch {
      // Fall back to the offline helper so the chat always responds.
      setMessages((prev) => [
        ...prev,
        {
          from: "assistant",
          text:
            getReply(clean) +
            "\n\n(Offline answer — the live AI is unavailable right now.)",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const chat = (
    <div
      className={`card flex flex-col overflow-hidden !p-0 ${
        fullscreen ? "h-full" : "h-[32rem]"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-navy-100 bg-navy-50 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
          <SparkleIcon />
        </span>
        <div>
          <div className="font-bold text-navy-900">MUN Assistant</div>
          <div className="text-xs text-navy-500">
            AI practice partner · Gemini {modelLabel(model)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {admin && (
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setAssistantModel(e.target.value);
              }}
              title="Switch the AI model (admin only)"
              aria-label="AI model"
              className="rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-xs font-semibold text-navy-700 focus:border-navy-500 focus:outline-none"
            >
              {ASSISTANT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-600 hover:bg-navy-100 hover:text-navy-900"
          >
            {fullscreen ? <MinimizeIcon width={18} height={18} /> : <ExpandIcon width={18} height={18} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}
          >
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

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-navy-50 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-400" />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 border-t border-navy-100 px-5 pt-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            disabled={loading}
            className="badge bg-navy-100 text-navy-700 hover:bg-navy-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-center gap-2 rounded-full border border-navy-200 bg-white px-4 py-2.5 focus-within:border-navy-500">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Generate a speech, draft a Point of Order, ask anything…"
            className="flex-1 bg-transparent text-sm text-navy-900 outline-none placeholder:text-silver-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-gold !px-4 !py-2 text-sm"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );

  // Fullscreen: the chat fills the viewport above everything else.
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-cream p-4 sm:p-6">
        {chat}
      </div>
    );
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {chat}

        {/* What it does */}
        <div>
          <h2 className="text-2xl font-bold text-navy-900">
            What the MUN Assistant does
          </h2>
          <p className="mt-3 text-navy-600">
            Ask anything, or have it generate ready-to-use material — speeches,
            Points of Order and Information, motions, and resolution clauses.
            Tap a suggestion or type your own request to get started.
          </p>
          <div className="mt-6 space-y-4">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-600">
                  <Icon width={22} height={22} />
                </span>
                <div>
                  <h3 className="font-bold text-navy-900">{title}</h3>
                  <p className="text-sm text-navy-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ModelDiplomatPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Practice"
        title="MUN Assistant"
        description="Your AI partner — generate speeches, draft Points of Order and Information, write resolution clauses, and ask anything about MUN."
        aside={
          <span className="badge bg-gold-500 text-navy-900">
            <SparkleIcon width={14} height={14} /> AI-powered
          </span>
        }
      />
      <MUNAssistant />
    </Protected>
  );
}
