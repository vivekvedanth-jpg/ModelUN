"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import {
  getVisibleQuestions,
  addQuestion,
  answerQuestion,
  deleteQuestion,
  type Question,
  type Visibility,
} from "@/lib/qa";
import {
  ChatIcon,
  GlobeIcon,
  LockIcon,
  TrashIcon,
  CheckIcon,
} from "./icons";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function QASection() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [error, setError] = useState("");

  // Per-question answer drafts (admin only).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuestions(getVisibleQuestions(user));
  }, [user]);

  function handleAsk(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setQuestions(addQuestion(user, text, visibility));
      setText("");
      setVisibility("public");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleAnswer(id: string) {
    setError("");
    try {
      setQuestions(answerQuestion(user, id, drafts[id] ?? ""));
      setDrafts((d) => ({ ...d, [id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleDelete(id: string) {
    setError("");
    try {
      setQuestions(deleteQuestion(user, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section className="mt-16 border-t border-navy-100 pt-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
          <ChatIcon width={22} height={22} />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Questions &amp; Answers</h2>
          <p className="text-navy-600">
            Ask the team anything. Choose a public question everyone can learn
            from, or a private one only you and the admins can see.
          </p>
        </div>
      </div>

      {/* Ask form */}
      <form
        onSubmit={handleAsk}
        className="mt-8 rounded-2xl border border-navy-100 bg-white p-5"
      >
        <label htmlFor="qa-text" className="label">
          Your question
        </label>
        <textarea
          id="qa-text"
          className="input-field min-h-[90px] resize-y"
          placeholder="e.g. How do I phrase an operative clause about funding?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="label">Visibility</span>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`badge inline-flex items-center gap-1.5 px-3 py-1.5 ${
                  visibility === "public"
                    ? "bg-navy-800 text-white"
                    : "bg-navy-100 text-navy-700"
                }`}
              >
                <GlobeIcon width={14} height={14} /> Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`badge inline-flex items-center gap-1.5 px-3 py-1.5 ${
                  visibility === "private"
                    ? "bg-navy-800 text-white"
                    : "bg-navy-100 text-navy-700"
                }`}
              >
                <LockIcon width={14} height={14} /> Private
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary">
            Post question
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {/* Questions list */}
      <div className="mt-8 space-y-4">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-navy-200 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
              <ChatIcon width={24} height={24} />
            </span>
            <p className="font-semibold text-navy-800">No questions yet</p>
            <p className="max-w-sm text-sm text-navy-500">
              Be the first to ask — your question will appear here.
            </p>
          </div>
        ) : (
          questions.map((q) => {
            const mine =
              user && q.author.toLowerCase() === user.email.toLowerCase();
            const canDelete = admin || mine;
            const authorName = q.author.split("@")[0] || q.author;
            return (
              <article
                key={q.id}
                className="rounded-2xl border border-navy-100 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                      {authorName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-semibold text-navy-900">
                      {authorName}
                    </span>
                    <span className="text-navy-400">· {timeAgo(q.createdAt)}</span>
                    <span
                      className={`badge inline-flex items-center gap-1 ${
                        q.visibility === "private"
                          ? "bg-navy-100 text-navy-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {q.visibility === "private" ? (
                        <>
                          <LockIcon width={12} height={12} /> Private
                        </>
                      ) : (
                        <>
                          <GlobeIcon width={12} height={12} /> Public
                        </>
                      )}
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      <TrashIcon width={14} height={14} /> Delete
                    </button>
                  )}
                </div>

                <p className="mt-3 text-navy-800">{q.text}</p>

                {/* Answer */}
                {q.answer ? (
                  <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50/60 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold-700">
                      <CheckIcon width={14} height={14} /> Answer from{" "}
                      {q.answeredBy?.split("@")[0] ?? "the team"}
                    </p>
                    <p className="mt-1.5 text-sm text-navy-800">{q.answer}</p>
                  </div>
                ) : admin ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Write an answer…"
                      value={drafts[q.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => handleAnswer(q.id)}
                      className="btn-gold whitespace-nowrap"
                    >
                      Post answer
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm italic text-navy-400">
                    Awaiting an answer from the team.
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
