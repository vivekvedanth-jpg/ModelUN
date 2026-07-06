"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  type ResolutionDoc,
} from "@/lib/documents";
import { getTemplates, type Template } from "@/lib/templates";
import {
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  CheckIcon,
  DocumentIcon,
  ExpandIcon,
  MinimizeIcon,
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

/* Tiny alignment / indent glyphs (kept inline to avoid touching the icon set). */
const svg = (paths: ReactNode) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    {paths}
  </svg>
);
const AlignLeft = svg(<><path d="M3 6h18" /><path d="M3 12h12" /><path d="M3 18h15" /></>);
const AlignCenter = svg(<><path d="M3 6h18" /><path d="M6 12h12" /><path d="M4 18h16" /></>);
const AlignRight = svg(<><path d="M3 6h18" /><path d="M9 12h12" /><path d="M6 18h15" /></>);
const AlignJustify = svg(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>);
const Outdent = svg(<><path d="M21 6H3" /><path d="M21 12h-8" /><path d="M21 18H3" /><path d="M7 9l-3 3 3 3" /></>);
const Indent = svg(<><path d="M3 6h18" /><path d="M11 12h10" /><path d="M3 18h18" /><path d="M4 9l3 3-3 3" /></>);

type Btn = { cmd: string; value?: string; title: string; label?: string; icon?: ReactNode };

/** Toolbar groups (rendered with dividers between them). */
const GROUPS: Btn[][] = [
  [
    { cmd: "undo", title: "Undo", label: "↶" },
    { cmd: "redo", title: "Redo", label: "↷" },
  ],
  [
    { cmd: "bold", title: "Bold", label: "B" },
    { cmd: "italic", title: "Italic", label: "I" },
    { cmd: "underline", title: "Underline", label: "U" },
    { cmd: "strikeThrough", title: "Strikethrough", label: "S" },
  ],
  [
    { cmd: "formatBlock", value: "h1", title: "Heading 1", label: "H1" },
    { cmd: "formatBlock", value: "h2", title: "Heading 2", label: "H2" },
    { cmd: "formatBlock", value: "h3", title: "Heading 3", label: "H3" },
    { cmd: "formatBlock", value: "p", title: "Normal text", label: "¶" },
    { cmd: "formatBlock", value: "blockquote", title: "Quote", label: "❝" },
  ],
  [
    { cmd: "justifyLeft", title: "Align left", icon: AlignLeft },
    { cmd: "justifyCenter", title: "Align center", icon: AlignCenter },
    { cmd: "justifyRight", title: "Align right", icon: AlignRight },
    { cmd: "justifyFull", title: "Justify", icon: AlignJustify },
  ],
  [
    { cmd: "insertUnorderedList", title: "Bulleted list", label: "•" },
    { cmd: "insertOrderedList", title: "Numbered list", label: "1." },
    { cmd: "outdent", title: "Outdent", icon: Outdent },
    { cmd: "indent", title: "Indent", icon: Indent },
  ],
  [
    { cmd: "insertHorizontalRule", title: "Divider", label: "―" },
    { cmd: "hiliteColor", value: "#fef08a", title: "Highlight", label: "🖍" },
    { cmd: "removeFormat", title: "Clear formatting", label: "⌫" },
  ],
];

export default function ResolutionEditor() {
  const { user } = useAuth();

  const [docs, setDocs] = useState<ResolutionDoc[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [words, setWords] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const latestHtmlRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0);
  const autosaveOk = useRef(false); // false until the active doc has loaded cleanly

  function refreshEmptyAndCount() {
    const el = editorRef.current;
    if (!el) return;
    const text = (el.textContent ?? "").trim();
    el.dataset.empty = text === "" ? "true" : "false";
    setWords(text === "" ? 0 : text.split(/\s+/).length);
  }

  async function doSave() {
    const id = activeIdRef.current;
    if (!id) return;
    // Prefer live DOM content, but fall back to the last snapshot so an unmount
    // (editorRef already null) never overwrites the doc with an empty string.
    const html = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    if (html === null) return; // nothing ever loaded — don't touch the doc
    const snapTitle = titleRef.current;
    try {
      await updateDocument(id, { title: snapTitle, html });
      // Only reflect status if we're still on the same document.
      if (activeIdRef.current === id) {
        setStatus("saved");
        setSavedAt(Date.now());
      }
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, title: snapTitle, html, updatedAt: Date.now() } : d
        )
      );
    } catch {
      if (activeIdRef.current === id) setStatus("error");
    }
  }

  function scheduleSave() {
    if (!autosaveOk.current) return; // don't autosave over a doc that failed to load
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void doSave(); }, 800);
  }

  function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void doSave();
    }
  }

  function selectDoc(doc: ResolutionDoc) {
    flushSave();
    activeIdRef.current = doc.id;
    titleRef.current = doc.title;
    setActiveId(doc.id);
    setTitle(doc.title);
  }

  // Load the active document's content into the editor when it changes, guarding
  // against out-of-order responses (A→B→A fast switching).
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !activeId) return;
    const seq = ++loadSeq.current;
    autosaveOk.current = false;
    setStatus("saving");
    getDocument(activeId)
      .then((doc) => {
        if (seq !== loadSeq.current) return; // a newer selection won
        if (!doc) {
          setStatus("error");
          return; // autosave stays disabled — never overwrite good content
        }
        el.innerHTML = doc.html ?? "";
        latestHtmlRef.current = el.innerHTML;
        refreshEmptyAndCount();
        setStatus("saved");
        autosaveOk.current = true;
      })
      .catch(() => {
        if (seq === loadSeq.current) setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Load documents + templates once we know who's signed in.
  useEffect(() => {
    if (!user) return;
    async function init() {
      let list = await getDocuments();
      if (list.length === 0) {
        await createDocument("My first resolution");
        list = await getDocuments();
      }
      setDocs(list);
      if (list[0]) selectDoc(list[0]);
    }
    void init();
    getTemplates().then(setTemplates).catch(() => setTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Save anything pending when the component unmounts.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        void doSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  function onTitleChange(v: string) {
    titleRef.current = v;
    setTitle(v);
    scheduleSave();
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    latestHtmlRef.current = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    refreshEmptyAndCount();
    scheduleSave();
  }

  async function createNew(template?: Template) {
    setNewMenuOpen(false);
    flushSave();
    const doc = await createDocument(
      template ? template.name : "Untitled resolution",
      template ? template.html : undefined
    );
    const list = await getDocuments();
    setDocs(list);
    selectDoc(doc);
  }

  async function removeDoc(id: string) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    if (id === activeIdRef.current) {
      // Deleting the active doc — drop its pending save.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    } else {
      // Deleting another doc — persist the active doc's pending edits first.
      flushSave();
    }
    await deleteDocument(id);
    let list = await getDocuments();
    if (activeIdRef.current === id) {
      if (list.length === 0) {
        await createDocument("Untitled resolution");
        list = await getDocuments();
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
    const body = editorRef.current?.innerHTML ?? latestHtmlRef.current ?? "";
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
  h3 { font-size: 13pt; }
  ul { padding-left: 24pt; list-style: disc; }
  ol { padding-left: 24pt; list-style: decimal; }
  p { margin: 8pt 0; }
  blockquote { margin: 8pt 0; padding-left: 14pt; border-left: 3px solid #c9ad6a; color: #333; font-style: italic; }
  hr { border: none; border-top: 1px solid #999; margin: 14pt 0; }
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style>
</head>
<body>
  <h1 class="doc-title">${safeTitle}</h1>
  ${body}
  <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`);
    w.document.close();
  }

  const statusNode =
    status === "saving" ? (
      <span className="inline-flex items-center gap-1 text-navy-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
        Saving…
      </span>
    ) : status === "error" ? (
      <span className="inline-flex items-center gap-1 text-red-600">
        ⚠ Couldn&apos;t save — will retry
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckIcon width={13} height={13} />
        {savedAt ? `Saved ${relativeTime(savedAt)}` : "All changes saved"}
      </span>
    );

  return (
    <div className={fullscreen ? "fixed inset-0 z-[70] flex bg-cream p-3 sm:p-6" : "grid gap-6 lg:grid-cols-[260px_1fr]"}>
      {/* Sidebar: document list (hidden in fullscreen) */}
      {!fullscreen && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <button onClick={() => setNewMenuOpen((v) => !v)} className="btn-primary w-full">
              <PlusIcon width={16} height={16} /> New document
            </button>
            {newMenuOpen && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-hidden
                  onClick={() => setNewMenuOpen(false)}
                />
                <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-navy-200 bg-white shadow-lg">
                  <button
                    onClick={() => createNew()}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-navy-50"
                  >
                    <span className="text-sm font-semibold text-navy-900">Blank document</span>
                    <span className="text-xs text-navy-500">Start from scratch</span>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => createNew(t)}
                      className="flex w-full flex-col border-t border-navy-100 px-4 py-2.5 text-left hover:bg-navy-50"
                    >
                      <span className="text-sm font-semibold text-navy-900">{t.name}</span>
                      <span className="text-xs text-navy-500">{t.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 space-y-1.5">
            {docs.map((d) => {
              const isActive = d.id === activeId;
              return (
                <div
                  key={d.id}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    isActive
                      ? "border-navy-800 bg-navy-50"
                      : "border-navy-100 bg-white hover:border-navy-300"
                  }`}
                >
                  <button onClick={() => selectDoc(d)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <DocumentIcon width={15} height={15} className="flex-shrink-0 text-navy-500" />
                      <span className="truncate text-sm font-semibold text-navy-900">{d.title}</span>
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
      )}

      {/* Editor (same elements in both layouts — never remounts) */}
      <div className={`card flex min-h-0 flex-col !p-0 ${fullscreen ? "flex-1" : ""}`}>
        {/* Title + status */}
        <div className="flex items-start justify-between gap-3 border-b border-navy-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Document title"
              className="w-full bg-transparent font-serif text-xl font-bold text-navy-900 outline-none placeholder:text-silver-500"
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-navy-500">{statusNode}</div>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
            className="flex-shrink-0 rounded-lg border border-navy-200 p-2 text-navy-600 hover:bg-navy-50"
          >
            {fullscreen ? <MinimizeIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-navy-100 bg-navy-50/60 px-3 py-2">
          {GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <span className="mx-1 h-5 w-px bg-navy-200" />}
              {group.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  title={t.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec(t.cmd, t.value)}
                  className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm text-navy-700 hover:bg-navy-200 ${
                    t.label === "B" ? "font-bold" : t.label === "I" ? "italic" : ""
                  } ${t.label === "U" ? "underline" : t.label === "S" ? "line-through" : ""}`}
                >
                  {t.icon ?? t.label}
                </button>
              ))}
            </div>
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
            latestHtmlRef.current = editorRef.current?.innerHTML ?? latestHtmlRef.current;
            refreshEmptyAndCount();
            scheduleSave();
          }}
          data-empty="true"
          data-placeholder="Start writing… Use the toolbar, or start a new document from a template."
          className="doc-content min-h-[55vh] flex-1 overflow-y-auto px-6 py-5"
        />

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-3">
          <span className="text-xs text-navy-500">
            {words} {words === 1 ? "word" : "words"} · Spell-check on
          </span>
          <button onClick={exportPdf} className="btn-gold !px-4 !py-2 text-sm">
            <DownloadIcon width={16} height={16} /> Download as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
