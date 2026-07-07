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
import { downscaleImage } from "@/lib/editor-images";
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

/* ── small inline icons not in the shared set ── */
const iconSvg = (paths: ReactNode, vb = "0 0 24 24") => (
  <svg width={15} height={15} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);
const AlignLeft = iconSvg(<><path d="M3 6h18" /><path d="M3 12h12" /><path d="M3 18h15" /></>);
const AlignCenter = iconSvg(<><path d="M3 6h18" /><path d="M6 12h12" /><path d="M4 18h16" /></>);
const AlignRight = iconSvg(<><path d="M3 6h18" /><path d="M9 12h12" /><path d="M6 18h15" /></>);
const AlignJustify = iconSvg(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>);
const OutdentI = iconSvg(<><path d="M21 6H3" /><path d="M21 12h-8" /><path d="M21 18H3" /><path d="M7 9l-3 3 3 3" /></>);
const IndentI = iconSvg(<><path d="M3 6h18" /><path d="M11 12h10" /><path d="M3 18h18" /><path d="M4 9l3 3-3 3" /></>);
const ImageI = iconSvg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>);
const LinkI = iconSvg(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

const FONTS = [
  { label: "Default font", value: "" },
  { label: "Serif (Georgia)", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Sans (Arial)", value: "Arial" },
  { label: "Courier", value: "Courier New" },
];
const SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "6" },
];

type ImgBox = { top: number; left: number; width: number; height: number };

/** A compact toolbar button (module-scoped so the toolbar never remounts). */
function TBtn({ onClick, title, children, className = "" }: { onClick: () => void; title: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm text-navy-700 hover:bg-navy-200 ${className}`}
    >
      {children}
    </button>
  );
}
function Divider() {
  return <span className="mx-1 h-5 w-px bg-navy-200" />;
}

/** Toolbar legend for the side guide. */
const TOOLBAR_LEGEND: { icon: string; title: string; desc: string }[] = [
  { icon: "↶ ↷", title: "Undo / Redo", desc: "Step backward or forward through edits." },
  { icon: "Font", title: "Font & size", desc: "Change the typeface and size of selected text." },
  { icon: "B I U S", title: "Text styles", desc: "Bold, Italic, Underline, Strikethrough." },
  { icon: "A ▟", title: "Colour & highlight", desc: "Set text colour, or highlight the selection." },
  { icon: "H1–H3 ¶", title: "Headings", desc: "Turn a line into a heading, or back to normal text (¶). ❝ makes a quote." },
  { icon: "⯇ ⯈", title: "Alignment", desc: "Align a paragraph left, centre, right, or justified." },
  { icon: "• 1.", title: "Lists", desc: "Bulleted list, or numbered clause list (auto-numbers operative clauses)." },
  { icon: "⇤ ⇥", title: "Indent", desc: "Nest a clause deeper / pull it back. Nesting cycles 1. → a. → i." },
  { icon: "🔗 🖼", title: "Link & image", desc: "Insert a hyperlink, or a picture (auto-resized; click it to resize, align, or delete)." },
  { icon: "―", title: "Divider", desc: "Insert a horizontal rule." },
  { icon: "✨", title: "Format & Lint", desc: "Auto-format preambulatory (italic + comma) and operative (bold + underline + numbered) clauses, and flag issues." },
  { icon: "⚖︎", title: "GA Mode", desc: "Warns when binding Security-Council language (Decides, Demands) is used." },
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
  const [selImg, setSelImg] = useState<HTMLImageElement | null>(null);
  const [imgBox, setImgBox] = useState<ImgBox | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const latestHtmlRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0);
  const autosaveOk = useRef(false);
  const gaModeRef = useRef(false);
  const selImgRef = useRef<HTMLImageElement | null>(null);
  const savedRange = useRef<Range | null>(null);

  function refreshEmptyAndCount() {
    const el = editorRef.current;
    if (!el) return;
    const text = (el.textContent ?? "").trim();
    el.dataset.empty = text === "" && !el.querySelector("img") ? "true" : "false";
    setWords(text === "" ? 0 : text.split(/\s+/).length);
  }

  async function doSave() {
    const id = activeIdRef.current;
    if (!id) return;
    const html = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    if (html === null) return;
    const snapTitle = titleRef.current;
    try {
      await updateDocument(id, { title: snapTitle, html });
      if (activeIdRef.current === id) {
        setStatus("saved");
        setSavedAt(Date.now());
      }
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, title: snapTitle, html, updatedAt: Date.now() } : d)));
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

  function afterEdit() {
    latestHtmlRef.current = editorRef.current?.innerHTML ?? latestHtmlRef.current;
    refreshEmptyAndCount();
    scheduleSave();
  }

  function deselectImage() {
    selImgRef.current = null;
    setSelImg(null);
    setImgBox(null);
  }

  function selectDoc(doc: ResolutionDoc) {
    flushSave();
    deselectImage();
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
        if (!doc) { setStatus("error"); return; }
        el.innerHTML = doc.html ?? "";
        latestHtmlRef.current = el.innerHTML;
        refreshEmptyAndCount();
        setStatus("saved");
        autosaveOk.current = true;
      })
      .catch(() => { if (seq === loadSeq.current) setStatus("error"); });
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
      if (saveTimer.current) { clearTimeout(saveTimer.current); void doSave(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape exits fullscreen / deselects an image.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selImgRef.current) deselectImage();
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => { gaModeRef.current = gaMode; }, [gaMode]);

  // Keep the selection overlay aligned on resize.
  useEffect(() => {
    const onResize = () => { if (selImgRef.current) updateImgBox(selImgRef.current); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    afterEdit();
  }

  // Font/size/colour controls steal focus (native select / colour picker), which
  // would drop the text selection. Stash it on interaction, restore before exec.
  function stashSelection() {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (el && sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function execOnStashed(cmd: string, value?: string) {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (el && savedRange.current && sel) {
      el.focus();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(cmd, false, value);
    afterEdit();
  }

  /* ── Images ── */

  function updateImgBox(img: HTMLImageElement | null) {
    const wrap = scrollRef.current;
    if (!img || !wrap) return;
    const ir = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setImgBox({
      top: ir.top - wr.top + wrap.scrollTop,
      left: ir.left - wr.left + wrap.scrollLeft,
      width: ir.width,
      height: ir.height,
    });
  }

  function selectImage(img: HTMLImageElement) {
    selImgRef.current = img;
    setSelImg(img);
    updateImgBox(img);
  }

  function insertNodeAtCaret(node: Node) {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(node);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (imgInputRef.current) imgInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { window.alert("Please choose an image file."); return; }
    if (file.size > 12 * 1024 * 1024) { window.alert("That image is too large (max 12 MB)."); return; }
    try {
      const dataUrl = await downscaleImage(file);
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const img = document.createElement("img");
      img.className = "doc-img";
      img.style.width = "55%";
      img.style.display = "block";
      img.style.margin = "10px auto";
      img.setAttribute("data-align", "center");
      // Re-measure once the image has real dimensions (data URLs size async).
      img.addEventListener("load", () => { if (selImgRef.current === img) updateImgBox(img); }, { once: true });
      img.src = dataUrl;
      insertNodeAtCaret(img);
      afterEdit();
      requestAnimationFrame(() => selectImage(img));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't insert the image.");
    }
  }

  function setImgWidth(pct: number) {
    const img = selImgRef.current;
    if (!img) return;
    img.style.width = `${pct}%`;
    updateImgBox(img);
    afterEdit();
  }

  function alignImage(mode: "left" | "center" | "right" | "inline") {
    const img = selImgRef.current;
    if (!img) return;
    const s = img.style;
    s.float = "";
    s.display = "";
    s.margin = "";
    if (mode === "left") { s.cssFloat = "left"; s.margin = "6px 14px 6px 0"; s.display = "inline"; }
    else if (mode === "right") { s.cssFloat = "right"; s.margin = "6px 0 6px 14px"; s.display = "inline"; }
    else if (mode === "center") { s.display = "block"; s.margin = "10px auto"; }
    else { s.display = "inline"; s.margin = "0 4px"; }
    img.setAttribute("data-align", mode);
    updateImgBox(img);
    afterEdit();
  }

  function deleteImage() {
    const img = selImgRef.current;
    if (!img) return;
    img.remove();
    deselectImage();
    afterEdit();
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    const img = selImgRef.current;
    const page = editorRef.current;
    if (!img || !page) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const pageW = page.clientWidth || 1;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const nextW = Math.max(40, startW + (ev.clientX - startX));
      const pct = Math.min(100, Math.max(8, Math.round((nextW / pageW) * 100)));
      img.style.width = `${pct}%`;
      updateImgBox(img);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      afterEdit();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  function onEditorPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLImageElement && editorRef.current?.contains(t)) {
      selectImage(t);
    } else if (selImgRef.current) {
      deselectImage();
    }
  }

  /* ── MUN: caret detection + smart indentation ── */

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
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) exec("outdent");
      else if (caretInList()) exec("indent");
      else exec("insertOrderedList");
      return;
    }
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

  function formatAndLint() {
    const el = editorRef.current;
    if (!el) return;
    deselectImage();
    const caret = saveCaret(el);
    const result = formatDocument(el, { gaMode: gaModeRef.current });
    restoreCaret(el, caret);
    setWarnings(result.warnings);
    setShowGuide(true);
    afterEdit();
  }

  function insertLink() {
    const url = window.prompt("Link URL (https://…):", "https://");
    if (!url) return;
    exec("createLink", url);
  }

  /* ── Documents ── */

  async function createNew(template?: Template) {
    setNewMenuOpen(false);
    flushSave();
    const doc = await createDocument(template ? template.name : "Untitled resolution", template ? template.html : undefined);
    const list = await getDocuments();
    setDocs(list);
    selectDoc(doc);
  }

  function insertTemplate(t: Template) {
    setInsertMenuOpen(false);
    const el = editorRef.current;
    if (!el) return;
    const empty = (el.textContent ?? "").trim() === "" && !el.querySelector("img");
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
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    } else {
      flushSave();
    }
    await deleteDocument(id);
    let list = await getDocuments();
    if (activeIdRef.current === id) {
      if (list.length === 0) { await createDocument("Untitled resolution"); list = await getDocuments(); }
      setDocs(list);
      selectDoc(list[0]);
    } else {
      setDocs(list);
    }
  }

  function exportPdf() {
    flushSave();
    const w = window.open("", "_blank");
    if (!w) { window.alert("Please allow pop-ups to download a PDF."); return; }
    const safeTitle = escapeHtml(titleRef.current || "Resolution");
    const body = editorRef.current?.innerHTML ?? latestHtmlRef.current ?? "";
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8" /><title>${safeTitle}</title>
<style>
  @page { margin: 1in; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0a1733; line-height: 1.6; }
  h1.doc-title { font-size: 22pt; margin: 0 0 16pt; }
  h1 { font-size: 18pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; }
  ul { padding-left: 24pt; list-style: disc; }
  ol { padding-left: 24pt; list-style: decimal; }
  ol ol { list-style: lower-alpha; } ol ol ol { list-style: lower-roman; }
  li { margin: 3pt 0; } p { margin: 8pt 0; }
  img { max-width: 100%; }
  .un-emblem { display: inline-block; }
  blockquote { margin: 8pt 0; padding-left: 14pt; border-left: 3px solid #c9ad6a; color: #333; font-style: italic; }
  hr { border: none; border-top: 1px solid #999; margin: 14pt 0; }
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style></head>
<body>
  <h1 class="doc-title">${safeTitle}</h1>
  ${body}
  <script>window.onload = function () { window.print(); };<\/script>
</body></html>`);
    w.document.close();
  }

  const statusNode =
    status === "saving" ? (
      <span className="inline-flex items-center gap-1 text-navy-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />Saving…
      </span>
    ) : status === "error" ? (
      <span className="inline-flex items-center gap-1 text-red-600">⚠ Couldn&apos;t save — will retry</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckIcon width={13} height={13} />{savedAt ? `Saved ${relativeTime(savedAt)}` : "All changes saved"}
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
      {/* Sidebar */}
      {!fullscreen && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <button onClick={() => setNewMenuOpen((v) => !v)} className="btn-primary w-full">
              <PlusIcon width={16} height={16} /> New document
            </button>
            {newMenuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setNewMenuOpen(false)} />
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-lg">
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
                <div key={d.id} className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isActive ? "border-navy-800 bg-navy-50" : "border-navy-100 bg-white hover:border-navy-300"}`}>
                  <button onClick={() => selectDoc(d)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <DocumentIcon width={15} height={15} className="flex-shrink-0 text-navy-500" />
                      <span className="truncate text-sm font-semibold text-navy-900">{d.title}</span>
                    </div>
                    <div className="mt-0.5 pl-[23px] text-xs text-navy-400">Edited {relativeTime(d.updatedAt)}</div>
                  </button>
                  <button onClick={() => removeDoc(d.id)} aria-label="Delete document" className="flex-shrink-0 rounded-lg p-1.5 text-navy-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100">
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Editor */}
      <div className={`card flex min-h-0 flex-col !p-0 ${fullscreen ? "flex-1" : ""}`}>
        {/* Title + status */}
        <div className="flex items-start justify-between gap-3 border-b border-navy-100 px-5 py-3">
          <div className="min-w-0 flex-1">
            <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Document title" className="w-full bg-transparent font-serif text-xl font-bold text-navy-900 outline-none placeholder:text-silver-500" />
            <div className="mt-0.5 flex items-center gap-2 text-xs text-navy-500">{statusNode}</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setShowGuide((v) => !v)} title="Editor guide" className={`rounded-lg border p-2 ${showGuide ? "border-navy-800 bg-navy-50 text-navy-800" : "border-navy-200 text-navy-600 hover:bg-navy-50"}`}>
              <BookIcon width={16} height={16} />
            </button>
            <button type="button" onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"} className="rounded-lg border border-navy-200 p-2 text-navy-600 hover:bg-navy-50">
              {fullscreen ? <MinimizeIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-navy-100 bg-navy-50/60 px-3 py-2">
          <TBtn onClick={() => exec("undo")} title="Undo">↶</TBtn>
          <TBtn onClick={() => exec("redo")} title="Redo">↷</TBtn>
          <Divider />
          <select onMouseDown={stashSelection} onChange={(e) => { if (e.target.value) execOnStashed("fontName", e.target.value); e.currentTarget.selectedIndex = 0; }} title="Font" className="h-8 rounded-md border border-navy-200 bg-white px-1.5 text-xs text-navy-700 focus:outline-none">
            {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
          <select onMouseDown={stashSelection} onChange={(e) => { if (e.target.value) execOnStashed("fontSize", e.target.value); e.currentTarget.selectedIndex = 0; }} title="Text size" className="h-8 rounded-md border border-navy-200 bg-white px-1.5 text-xs text-navy-700 focus:outline-none">
            <option value="">Size</option>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Divider />
          <TBtn onClick={() => exec("bold")} title="Bold" className="font-bold">B</TBtn>
          <TBtn onClick={() => exec("italic")} title="Italic" className="italic">I</TBtn>
          <TBtn onClick={() => exec("underline")} title="Underline" className="underline">U</TBtn>
          <TBtn onClick={() => exec("strikeThrough")} title="Strikethrough" className="line-through">S</TBtn>
          <label onMouseDown={stashSelection} title="Text colour" className="flex h-8 cursor-pointer items-center justify-center rounded-md px-1.5 text-sm font-semibold text-navy-700 hover:bg-navy-200">
            A<span className="ml-0.5 h-1 w-3 rounded-sm bg-red-500" />
            <input type="color" className="sr-only" onChange={(e) => execOnStashed("foreColor", e.target.value)} />
          </label>
          <label onMouseDown={stashSelection} title="Highlight colour" className="flex h-8 cursor-pointer items-center justify-center rounded-md px-1.5 text-sm hover:bg-navy-200">
            🖍<input type="color" defaultValue="#fef08a" className="sr-only" onChange={(e) => execOnStashed("hiliteColor", e.target.value)} />
          </label>
          <Divider />
          <TBtn onClick={() => exec("formatBlock", "h1")} title="Heading 1">H1</TBtn>
          <TBtn onClick={() => exec("formatBlock", "h2")} title="Heading 2">H2</TBtn>
          <TBtn onClick={() => exec("formatBlock", "h3")} title="Heading 3">H3</TBtn>
          <TBtn onClick={() => exec("formatBlock", "p")} title="Normal text">¶</TBtn>
          <TBtn onClick={() => exec("formatBlock", "blockquote")} title="Quote">❝</TBtn>
          <Divider />
          <TBtn onClick={() => exec("justifyLeft")} title="Align left">{AlignLeft}</TBtn>
          <TBtn onClick={() => exec("justifyCenter")} title="Align centre">{AlignCenter}</TBtn>
          <TBtn onClick={() => exec("justifyRight")} title="Align right">{AlignRight}</TBtn>
          <TBtn onClick={() => exec("justifyFull")} title="Justify">{AlignJustify}</TBtn>
          <Divider />
          <TBtn onClick={() => exec("insertUnorderedList")} title="Bulleted list">•</TBtn>
          <TBtn onClick={() => exec("insertOrderedList")} title="Numbered clause list">1.</TBtn>
          <TBtn onClick={() => exec("outdent")} title="Outdent (Shift+Tab)">{OutdentI}</TBtn>
          <TBtn onClick={() => exec("indent")} title="Indent / nest clause (Tab)">{IndentI}</TBtn>
          <Divider />
          <TBtn onClick={insertLink} title="Insert link">{LinkI}</TBtn>
          <TBtn onClick={() => imgInputRef.current?.click()} title="Insert image">{ImageI}</TBtn>
          <TBtn onClick={() => exec("insertHorizontalRule")} title="Divider">―</TBtn>
          <TBtn onClick={() => exec("removeFormat")} title="Clear formatting">⌫</TBtn>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>

        {/* MUN tools row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 bg-white px-3 py-2">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={formatAndLint} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900" title="Auto-format clauses and lint the document">
            <SparkleIcon width={14} height={14} /> Format &amp; Lint
          </button>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${gaMode ? "border-gold-300 bg-gold-50 text-gold-700" : "border-navy-200 text-navy-600"}`} title="Warn on binding Security-Council language">
            <input type="checkbox" checked={gaMode} onChange={(e) => setGaMode(e.target.checked)} className="accent-gold-600" />
            <ScaleIcon width={13} height={13} /> GA Mode
          </label>
          <div className="relative">
            <button type="button" onClick={() => setInsertMenuOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">
              <DocumentIcon width={13} height={13} /> Insert template ▾
            </button>
            {insertMenuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setInsertMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-lg">
                  {templates.length === 0 ? (
                    <div className="px-4 py-2.5 text-xs text-navy-500">No templates available.</div>
                  ) : templates.map((t) => (
                    <button key={t.id} onClick={() => insertTemplate(t)} className="flex w-full flex-col border-b border-navy-100 px-4 py-2.5 text-left last:border-0 hover:bg-navy-50">
                      <span className="text-sm font-semibold text-navy-900">{t.name}</span>
                      <span className="text-xs text-navy-500">{t.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {warnings.length > 0 && (
            <button type="button" onClick={() => setShowGuide(true)} className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${warnCount > 0 ? "bg-red-50 text-red-600" : "bg-navy-50 text-navy-600"}`}>
              {warnCount > 0 ? `⚠ ${warnCount} issue${warnCount === 1 ? "" : "s"}` : "✓ Looks good"}
            </button>
          )}
        </div>

        {/* Image contextual bar */}
        {selImg && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-navy-100 bg-navy-800 px-3 py-2 text-xs text-white">
            <span className="mr-1 inline-flex items-center gap-1 font-semibold">{ImageI} Image</span>
            <span className="text-navy-300">Size:</span>
            {[25, 50, 75, 100].map((p) => (
              <button key={p} onMouseDown={(e) => e.preventDefault()} onClick={() => setImgWidth(p)} className="rounded bg-navy-700 px-2 py-1 font-semibold hover:bg-navy-600">{p}%</button>
            ))}
            <span className="ml-2 text-navy-300">Align:</span>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => alignImage("left")} className="rounded bg-navy-700 px-2 py-1 hover:bg-navy-600">Left</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => alignImage("center")} className="rounded bg-navy-700 px-2 py-1 hover:bg-navy-600">Center</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => alignImage("right")} className="rounded bg-navy-700 px-2 py-1 hover:bg-navy-600">Right</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => alignImage("inline")} className="rounded bg-navy-700 px-2 py-1 hover:bg-navy-600">Inline</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={deleteImage} className="ml-2 rounded bg-red-600 px-2 py-1 font-semibold hover:bg-red-500">Delete</button>
            <span className="ml-auto hidden text-navy-300 sm:inline">Drag the corner handle to resize freely</span>
          </div>
        )}

        {/* Editable page (document look) */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto bg-navy-50/40">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            lang="en"
            onKeyDown={onEditorKeyDown}
            onInput={afterEdit}
            onPointerDown={onEditorPointerDown}
            data-empty="true"
            data-placeholder="Start writing… Insert a template, add a picture, or type a clause like “Recalling…” or “Urges…” then press Format & Lint."
            className="doc-content mx-auto my-6 min-h-[60vh] max-w-[820px] rounded-md bg-white px-8 py-10 shadow-sm sm:px-12"
          />

          {/* Image selection overlay */}
          {imgBox && selImg && (
            <>
              <div className="pointer-events-none absolute rounded-sm ring-2 ring-navy-500" style={{ top: imgBox.top, left: imgBox.left, width: imgBox.width, height: imgBox.height }} />
              <div
                onPointerDown={startResize}
                className="absolute z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-navy-700 shadow"
                style={{ top: imgBox.top + imgBox.height - 7, left: imgBox.left + imgBox.width - 7 }}
                title="Drag to resize"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-3">
          <span className="text-xs text-navy-500">{words} {words === 1 ? "word" : "words"} · Tab to nest · click a picture to resize</span>
          <button onClick={exportPdf} className="btn-gold !px-4 !py-2 text-sm">
            <DownloadIcon width={16} height={16} /> Download as PDF
          </button>
        </div>
      </div>

      {/* Guide panel */}
      {!fullscreen && showGuide && (
        <aside className="lg:col-span-2 xl:col-span-1">
          <div className="card space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-navy-900"><BookIcon width={16} height={16} /> Editor guide</h3>
              <button onClick={() => setShowGuide(false)} aria-label="Close guide" className="rounded p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700"><CloseIcon width={14} height={14} /></button>
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Lint results</p>
                {warnings.map((w, i) => (
                  <p key={i} className={`rounded-lg border px-3 py-2 text-xs ${w.severity === "warning" ? "border-red-200 bg-red-50 text-red-700" : "border-navy-100 bg-navy-50 text-navy-600"}`}>
                    {w.severity === "warning" ? "⚠ " : "ℹ "}{w.message}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-navy-100 pt-3 text-xs text-navy-600">
              <p className="font-semibold text-navy-800">MUN drafting</p>
              <p><span className="font-semibold italic">Preambulatory</span> phrases ({PREAMBULATORY_PHRASES.slice(0, 3).join(", ")}…) auto-italicise and end with a comma.</p>
              <p><span className="font-semibold underline">Operative</span> phrases ({OPERATIVE_PHRASES.slice(0, 3).join(", ")}…) bold + underline, auto-number, and end with a semicolon — the last with a period.</p>
              <p><strong>Tab</strong> nests a clause (1. → a. → i.); <strong>Shift+Tab</strong> pulls it back. In <strong>GA Mode</strong>, binding SC words ({SC_BINDING_PHRASES.join(", ")}) are flagged.</p>
              <p><strong>Pictures:</strong> click <span className="font-semibold">🖼</span> to add one; click a picture to resize (buttons or drag its corner), align, or delete.</p>
              {isAdmin(user?.role) && (
                <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-gold-700">
                  <span className="font-semibold">Admin:</span> create &amp; edit templates at{" "}
                  <Link href="/admin/templates" className="font-semibold underline">Admin → Document Templates</Link>.
                </p>
              )}
            </div>

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
