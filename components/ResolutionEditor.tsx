"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
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
  formatDocument,
  formatClauseBlock,
  saveCaret,
  restoreCaret,
  PREAMBULATORY_PHRASES,
  OPERATIVE_PHRASES,
  SC_BINDING_PHRASES,
  type LintWarning,
} from "@/lib/mun-format";
import {
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  CheckIcon,
  DocumentIcon,
  ExpandIcon,
  MinimizeIcon,
  SparkleIcon,
  BookIcon,
  ScaleIcon,
  CloseIcon,
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
    { cmd: "insertOrderedList", title: "Numbered clause list", label: "1." },
    { cmd: "outdent", title: "Outdent (Shift+Tab)", icon: Outdent },
    { cmd: "indent", title: "Indent / nest clause (Tab)", icon: Indent },
  ],
  [
    { cmd: "insertHorizontalRule", title: "Divider", label: "―" },
    { cmd: "hiliteColor", value: "#fef08a", title: "Highlight", label: "🖍" },
    { cmd: "removeFormat", title: "Clear formatting", label: "⌫" },
  ],
];

/** Legend describing every toolbar control (shown in the side guide). */
const TOOLBAR_LEGEND: { icon: string; title: string; desc: string }[] = [
  { icon: "↶ ↷", title: "Undo / Redo", desc: "Step backward or forward through your edits." },
  { icon: "B I U S", title: "Text styles", desc: "Bold, Italic, Underline, and Strikethrough the selected text." },
  { icon: "H1 H2 H3 ¶", title: "Headings & text", desc: "Turn a line into a heading, or back into normal paragraph text (¶)." },
  { icon: "❝", title: "Quote", desc: "Format a line as an indented block quote." },
  { icon: "⯇ ⯈", title: "Alignment", desc: "Align a paragraph left, centre, right, or justified." },
  { icon: "• 1.", title: "Lists", desc: "Bulleted list, or a numbered clause list that auto-numbers operative clauses." },
  { icon: "⇤ ⇥", title: "Indent / Outdent", desc: "Nest a clause deeper or pull it back. Nesting cycles 1. → a. → i." },
  { icon: "―", title: "Divider", desc: "Insert a horizontal rule to separate sections." },
  { icon: "🖍", title: "Highlight", desc: "Highlight the selected text in yellow." },
  { icon: "⌫", title: "Clear", desc: "Strip all formatting from the selection." },
  { icon: "✨", title: "Format & Lint", desc: "Auto-format the whole document: italicise preambulatory phrases (ending in a comma), bold + underline and number operative clauses (ending in a semicolon, the last in a period), and flag any issues." },
  { icon: "⚖︎", title: "GA Mode", desc: "General Assembly mode — warns when you use binding Security-Council language like “Decides” or “Demands”." },
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
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [gaMode, setGaMode] = useState(false);
  const [warnings, setWarnings] = useState<LintWarning[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const latestHtmlRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0);
  const autosaveOk = useRef(false); // false until the active doc has loaded cleanly
  const gaModeRef = useRef(false);

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
    const html = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    if (html === null) return; // nothing ever loaded — don't touch the doc
    const snapTitle = titleRef.current;
    try {
      await updateDocument(id, { title: snapTitle, html });
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
    if (!autosaveOk.current) return;
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
    setWarnings([]);
  }

  // Load the active document, guarding against out-of-order responses.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !activeId) return;
    const seq = ++loadSeq.current;
    autosaveOk.current = false;
    setStatus("saving");
    getDocument(activeId)
      .then((doc) => {
        if (seq !== loadSeq.current) return;
        if (!doc) {
          setStatus("error");
          return;
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

  useEffect(() => { gaModeRef.current = gaMode; }, [gaMode]);

  function onTitleChange(v: string) {
    titleRef.current = v;
    setTitle(v);
    scheduleSave();
  }

  function afterEdit() {
    latestHtmlRef.current = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    refreshEmptyAndCount();
    scheduleSave();
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    afterEdit();
  }

  /* ── MUN: caret block detection + smart indentation ── */

  function caretBlock(): HTMLElement | null {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== el) {
      if (node.nodeType === 1) {
        const t = (node as HTMLElement).tagName;
        if (/^(P|DIV|LI|H1|H2|H3|BLOCKQUOTE)$/.test(t)) return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  function caretInList(): boolean {
    const b = caretBlock();
    return !!b && (b.tagName === "LI" || !!b.closest("ol,ul"));
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Tab / Shift+Tab — nest or un-nest a clause (1. → a. → i.).
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        exec("outdent");
      } else if (caretInList()) {
        exec("indent");
      } else {
        // Start a numbered clause list from a plain line.
        exec("insertOrderedList");
      }
      return;
    }
    // Enter — auto-nest after a lead-in clause ending ":", else light-format the
    // clause just completed.
    if (e.key === "Enter" && !e.shiftKey) {
      const block = caretBlock();
      const endsWithColon = (block?.textContent ?? "").trim().endsWith(":");
      if (endsWithColon && caretInList()) {
        requestAnimationFrame(() => { try { exec("indent"); } catch { /* noop */ } });
        return;
      }
      if (block && (block.tagName === "P" || block.tagName === "DIV")) {
        requestAnimationFrame(() => {
          try { formatClauseBlock(block); } catch { /* never break typing */ }
          afterEdit();
        });
      }
    }
  }

  /* ── MUN: full format + lint pass ── */

  function formatAndLint() {
    const el = editorRef.current;
    if (!el) return;
    const caret = saveCaret(el);
    const result = formatDocument(el, { gaMode: gaModeRef.current });
    restoreCaret(el, caret);
    setWarnings(result.warnings);
    setShowGuide(true);
    afterEdit();
  }

  /* ── Documents ── */

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

  function insertTemplate(t: Template) {
    setInsertMenuOpen(false);
    const el = editorRef.current;
    if (!el) return;
    const empty = (el.textContent ?? "").trim() === "";
    if (empty) {
      el.innerHTML = t.html;
    } else {
      if (!window.confirm(`Insert the "${t.name}" boilerplate at the end of this document?`)) return;
      el.insertAdjacentHTML("beforeend", t.html);
    }
    afterEdit();
    el.focus();
  }

  async function removeDoc(id: string) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    if (id === activeIdRef.current) {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    } else {
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
  ol ol { list-style: lower-alpha; }
  ol ol ol { list-style: lower-roman; }
  li { margin: 3pt 0; }
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

  const warnCount = warnings.filter((w) => w.severity === "warning").length;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[70] flex bg-cream p-3 sm:p-6"
          : "grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_300px]"
      }
    >
      {/* Sidebar: document list (hidden in fullscreen) */}
      {!fullscreen && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <button onClick={() => setNewMenuOpen((v) => !v)} className="btn-primary w-full">
              <PlusIcon width={16} height={16} /> New document
            </button>
            {newMenuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setNewMenuOpen(false)} />
                <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-navy-200 bg-white shadow-lg">
                  <button onClick={() => createNew()} className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-navy-50">
                    <span className="text-sm font-semibold text-navy-900">Blank document</span>
                    <span className="text-xs text-navy-500">Start from scratch</span>
                  </button>
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => createNew(t)} className="flex w-full flex-col border-t border-navy-100 px-4 py-2.5 text-left hover:bg-navy-50">
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
                    isActive ? "border-navy-800 bg-navy-50" : "border-navy-100 bg-white hover:border-navy-300"
                  }`}
                >
                  <button onClick={() => selectDoc(d)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <DocumentIcon width={15} height={15} className="flex-shrink-0 text-navy-500" />
                      <span className="truncate text-sm font-semibold text-navy-900">{d.title}</span>
                    </div>
                    <div className="mt-0.5 pl-[23px] text-xs text-navy-400">Edited {relativeTime(d.updatedAt)}</div>
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
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              title="Editor guide"
              className={`rounded-lg border p-2 ${showGuide ? "border-navy-800 bg-navy-50 text-navy-800" : "border-navy-200 text-navy-600 hover:bg-navy-50"}`}
            >
              <BookIcon width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
              className="rounded-lg border border-navy-200 p-2 text-navy-600 hover:bg-navy-50"
            >
              {fullscreen ? <MinimizeIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
            </button>
          </div>
        </div>

        {/* Formatting toolbar */}
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

        {/* MUN tools row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 bg-white px-3 py-2">
          <button
            type="button"
            onClick={formatAndLint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900"
            title="Auto-format preambulatory & operative clauses and lint the document"
          >
            <SparkleIcon width={14} height={14} /> Format &amp; Lint
          </button>

          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              gaMode ? "border-gold-300 bg-gold-50 text-gold-700" : "border-navy-200 text-navy-600"
            }`}
            title="Warn when binding Security-Council language is used"
          >
            <input type="checkbox" checked={gaMode} onChange={(e) => setGaMode(e.target.checked)} className="accent-gold-600" />
            <ScaleIcon width={13} height={13} /> GA Mode
          </label>

          {/* Insert template */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setInsertMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50"
            >
              <DocumentIcon width={13} height={13} /> Insert template ▾
            </button>
            {insertMenuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setInsertMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-navy-200 bg-white shadow-lg">
                  {templates.length === 0 ? (
                    <div className="px-4 py-2.5 text-xs text-navy-500">No templates available.</div>
                  ) : (
                    templates.map((t) => (
                      <button key={t.id} onClick={() => insertTemplate(t)} className="flex w-full flex-col border-b border-navy-100 px-4 py-2.5 text-left last:border-0 hover:bg-navy-50">
                        <span className="text-sm font-semibold text-navy-900">{t.name}</span>
                        <span className="text-xs text-navy-500">{t.description}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {warnings.length > 0 && (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                warnCount > 0 ? "bg-red-50 text-red-600" : "bg-navy-50 text-navy-600"
              }`}
            >
              {warnCount > 0 ? `⚠ ${warnCount} issue${warnCount === 1 ? "" : "s"}` : "✓ Looks good"}
            </button>
          )}
        </div>

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          lang="en"
          onKeyDown={onEditorKeyDown}
          onInput={afterEdit}
          data-empty="true"
          data-placeholder="Start writing… Insert a template, or type a clause like “Recalling…” or “Urges…” and press Format & Lint."
          className="doc-content min-h-[55vh] flex-1 overflow-y-auto px-6 py-5"
        />

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-3">
          <span className="text-xs text-navy-500">
            {words} {words === 1 ? "word" : "words"} · Tab to nest · Format &amp; Lint to auto-format
          </span>
          <button onClick={exportPdf} className="btn-gold !px-4 !py-2 text-sm">
            <DownloadIcon width={16} height={16} /> Download as PDF
          </button>
        </div>
      </div>

      {/* Guide / description panel (hidden in fullscreen) */}
      {!fullscreen && showGuide && (
        <aside className="lg:col-span-2 xl:col-span-1">
          <div className="card space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-navy-900">
                <BookIcon width={16} height={16} /> Editor guide
              </h3>
              <button onClick={() => setShowGuide(false)} aria-label="Close guide" className="rounded p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700">
                <CloseIcon width={14} height={14} />
              </button>
            </div>

            {/* Live lint results */}
            {warnings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Lint results</p>
                {warnings.map((w, i) => (
                  <p
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      w.severity === "warning"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-navy-100 bg-navy-50 text-navy-600"
                    }`}
                  >
                    {w.severity === "warning" ? "⚠ " : "ℹ "}{w.message}
                  </p>
                ))}
              </div>
            )}

            {/* MUN feature help */}
            <div className="space-y-2 border-t border-navy-100 pt-3 text-xs text-navy-600">
              <p className="font-semibold text-navy-800">MUN drafting</p>
              <p><span className="font-semibold italic">Preambulatory</span> phrases (e.g. {PREAMBULATORY_PHRASES.slice(0, 3).join(", ")}…) auto-italicise and end with a comma.</p>
              <p><span className="font-semibold underline">Operative</span> phrases (e.g. {OPERATIVE_PHRASES.slice(0, 3).join(", ")}…) bold + underline, auto-number, and end with a semicolon — the last one with a period.</p>
              <p><strong>Tab</strong> nests a clause deeper (1. → a. → i.); <strong>Shift+Tab</strong> pulls it back. Ending a lead-in line with “:” then Enter also nests.</p>
              <p>In <strong>GA Mode</strong>, binding SC words ({SC_BINDING_PHRASES.join(", ")}) are flagged.</p>
              {isAdmin(user?.role) && (
                <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-gold-700">
                  <span className="font-semibold">Admin:</span> edit the template formats at{" "}
                  <Link href="/admin/templates" className="font-semibold underline">Admin → Document Templates</Link>.
                </p>
              )}
            </div>

            {/* Toolbar legend */}
            <div className="space-y-2 border-t border-navy-100 pt-3">
              <p className="text-xs font-semibold text-navy-800">Toolbar</p>
              <dl className="space-y-1.5">
                {TOOLBAR_LEGEND.map((t) => (
                  <div key={t.title} className="text-xs">
                    <dt className="flex items-center gap-1.5 font-semibold text-navy-800">
                      <span className="inline-flex min-w-[2.5rem] justify-center rounded bg-navy-100 px-1 py-0.5 font-mono text-[10px] text-navy-600">{t.icon}</span>
                      {t.title}
                    </dt>
                    <dd className="mt-0.5 pl-1 text-navy-500">{t.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
