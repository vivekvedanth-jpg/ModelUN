"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  type ResolutionDoc,
} from "@/lib/documents";
import {
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  CheckIcon,
  DocumentIcon,
} from "./icons";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

const TOOLBAR: { label: string; cmd: string; value?: string; title: string }[] = [
  { label: "B", cmd: "bold", title: "Bold" },
  { label: "I", cmd: "italic", title: "Italic" },
  { label: "U", cmd: "underline", title: "Underline" },
  { label: "H1", cmd: "formatBlock", value: "h1", title: "Heading 1" },
  { label: "H2", cmd: "formatBlock", value: "h2", title: "Heading 2" },
  { label: "¶", cmd: "formatBlock", value: "p", title: "Normal text" },
  { label: "• List", cmd: "insertUnorderedList", title: "Bulleted list" },
  { label: "1. List", cmd: "insertOrderedList", title: "Numbered list" },
  { label: "⌫ Clear", cmd: "removeFormat", title: "Clear formatting" },
];

export default function ResolutionEditor() {
  const { user } = useAuth();

  const [docs, setDocs] = useState<ResolutionDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [words, setWords] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  userRef.current = user; // always read the latest user inside saves

  function refreshEmptyAndCount() {
    const el = editorRef.current;
    if (!el) return;
    const text = (el.textContent ?? "").trim();
    el.dataset.empty = text === "" ? "true" : "false";
    setWords(text === "" ? 0 : text.split(/\s+/).length);
  }

  function doSave() {
    const id = activeIdRef.current;
    const u = userRef.current;
    if (!id || !u) return;
    const html = editorRef.current?.innerHTML ?? "";
    try {
      updateDocument(u, id, { title: titleRef.current, html });
      setStatus("saved");
      setSavedAt(Date.now());
      setDocs(getDocuments(u.email));
    } catch {
      // Document may have been removed; ignore.
      setStatus("saved");
    }
  }

  function scheduleSave() {
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 800);
  }

  function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      doSave();
    }
  }

  function selectDoc(doc: ResolutionDoc) {
    flushSave();
    activeIdRef.current = doc.id;
    titleRef.current = doc.title;
    setActiveId(doc.id);
    setTitle(doc.title);
  }

  // Load (or create) the delegate's documents once we know who's signed in.
  useEffect(() => {
    if (!user) return;
    let list = getDocuments(user.email);
    if (list.length === 0) {
      createDocument(user, "My first resolution");
      list = getDocuments(user.email);
    }
    setDocs(list);
    selectDoc(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load the active document's content into the editor when it changes.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !activeId) return;
    el.innerHTML = getDocument(activeId)?.html ?? "";
    refreshEmptyAndCount();
    setStatus("saved");
  }, [activeId]);

  // Save anything pending if the user leaves the page.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        doSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTitleChange(v: string) {
    titleRef.current = v;
    setTitle(v);
    scheduleSave();
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    refreshEmptyAndCount();
    scheduleSave();
  }

  function newDoc() {
    if (!user) return;
    flushSave();
    createDocument(user, "Untitled resolution");
    const list = getDocuments(user.email);
    setDocs(list);
    selectDoc(list[0]);
  }

  function removeDoc(id: string) {
    if (!user) return;
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    // Cancel any pending save so we don't resurrect a deleted doc.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    let list = deleteDocument(user, id);
    if (activeIdRef.current === id) {
      if (list.length === 0) {
        createDocument(user, "Untitled resolution");
        list = getDocuments(user.email);
      }
      setDocs(list);
      selectDoc(list[0]);
    } else {
      setDocs(list);
    }
  }

  function exportPdf() {
    flushSave();
    const w = window.open("", "_blank");
    if (!w) {
      window.alert("Please allow pop-ups to download a PDF.");
      return;
    }
    const safeTitle = escapeHtml(titleRef.current || "Resolution");
    const body = editorRef.current?.innerHTML ?? "";
    w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  @page { margin: 1in; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0a1733; line-height: 1.6; }
  h1.doc-title { font-size: 22pt; margin: 0 0 16pt; }
  h1 { font-size: 18pt; }
  h2 { font-size: 15pt; }
  ul { padding-left: 24pt; list-style: disc; }
  ol { padding-left: 24pt; list-style: decimal; }
  p { margin: 8pt 0; }
</style>
</head>
<body>
  <h1 class="doc-title">${safeTitle}</h1>
  ${body}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
    w.document.close();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Sidebar: document list */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <button onClick={newDoc} className="btn-primary w-full">
          <PlusIcon width={16} height={16} /> New document
        </button>

        <div className="mt-4 space-y-1.5">
          {docs.map((d) => {
            const active = d.id === activeId;
            return (
              <div
                key={d.id}
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  active
                    ? "border-navy-800 bg-navy-50"
                    : "border-navy-100 bg-white hover:border-navy-300"
                }`}
              >
                <button
                  onClick={() => selectDoc(d)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <DocumentIcon
                      width={15}
                      height={15}
                      className="flex-shrink-0 text-navy-500"
                    />
                    <span className="truncate text-sm font-semibold text-navy-900">
                      {d.title}
                    </span>
                  </div>
                  <div className="mt-0.5 pl-[23px] text-xs text-navy-400">
                    Edited {relativeTime(d.updatedAt)}
                  </div>
                </button>
                <button
                  onClick={() => removeDoc(d.id)}
                  aria-label="Delete document"
                  className="flex-shrink-0 rounded-lg p-1.5 text-navy-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Editor */}
      <div className="card flex flex-col !p-0">
        {/* Title + status */}
        <div className="border-b border-navy-100 px-5 py-4">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Document title"
            className="w-full bg-transparent font-serif text-xl font-bold text-navy-900 outline-none placeholder:text-silver-500"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-navy-500">
            {status === "saving" ? (
              <span className="inline-flex items-center gap-1 text-navy-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
                Saving…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckIcon width={13} height={13} />
                {savedAt ? `Saved ${relativeTime(savedAt)}` : "All changes saved"}
              </span>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-navy-100 bg-navy-50/60 px-3 py-2">
          {TOOLBAR.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(t.cmd, t.value)}
              className={`rounded-md px-2.5 py-1.5 text-sm text-navy-700 hover:bg-navy-200 ${
                t.label === "B" ? "font-bold" : t.label === "I" ? "italic" : ""
              } ${t.label === "U" ? "underline" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          lang="en"
          onInput={() => {
            refreshEmptyAndCount();
            scheduleSave();
          }}
          data-empty="true"
          data-placeholder="Start writing your resolution… Use the toolbar for clauses, headings, and lists."
          className="doc-content min-h-[55vh] flex-1 overflow-y-auto px-6 py-5"
        />

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-3">
          <span className="text-xs text-navy-500">
            {words} {words === 1 ? "word" : "words"} · Spell-check on (misspellings
            are underlined as you type)
          </span>
          <button onClick={exportPdf} className="btn-gold !px-4 !py-2 text-sm">
            <DownloadIcon width={16} height={16} /> Download as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
