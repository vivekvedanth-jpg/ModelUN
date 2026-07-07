"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  resetTemplate,
  deleteTemplate,
  type Template,
} from "@/lib/templates";
import { downscaleImage } from "@/lib/editor-images";
import { CheckIcon, DocumentIcon, PlusIcon, TrashIcon } from "./icons";

type Cmd = { label: string; cmd: string; value?: string; title: string };
const TOOLBAR: Cmd[] = [
  { label: "B", cmd: "bold", title: "Bold" },
  { label: "I", cmd: "italic", title: "Italic" },
  { label: "U", cmd: "underline", title: "Underline" },
  { label: "S", cmd: "strikeThrough", title: "Strikethrough" },
  { label: "H1", cmd: "formatBlock", value: "h1", title: "Heading 1" },
  { label: "H2", cmd: "formatBlock", value: "h2", title: "Heading 2" },
  { label: "H3", cmd: "formatBlock", value: "h3", title: "Heading 3" },
  { label: "¶", cmd: "formatBlock", value: "p", title: "Normal text" },
  { label: "❝", cmd: "formatBlock", value: "blockquote", title: "Quote" },
  { label: "•", cmd: "insertUnorderedList", title: "Bulleted list" },
  { label: "1.", cmd: "insertOrderedList", title: "Numbered list" },
  { label: "⌫", cmd: "removeFormat", title: "Clear formatting" },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const active = templates.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    getTemplates()
      .then((list) => {
        setTemplates(list);
        if (list[0]) setActiveId(list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load templates."));
  }, []);

  // Load the selected template into the editor whenever it changes.
  useEffect(() => {
    if (!active) return;
    setName(active.name);
    setDescription(active.description);
    if (editorRef.current) editorRef.current.innerHTML = active.html;
    setNotice("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (imgInputRef.current) imgInputRef.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await downscaleImage(file, 900, 0.8);
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const img = document.createElement("img");
      img.src = dataUrl;
      img.style.maxWidth = "40%";
      img.style.display = "block";
      img.style.margin = "8px auto";
      const sel = window.getSelection();
      if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0);
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
      } else {
        el.appendChild(img);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't insert the image.");
    }
  }

  async function newTemplate() {
    const tName = window.prompt("Name for the new template:", "New template");
    if (!tName || !tName.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createTemplate({
        name: tName.trim(),
        description: "Custom template.",
        html: "<h1>New template</h1>\n<p>Start your boilerplate here…</p>",
      });
      setTemplates((prev) => [...prev, created]);
      setActiveId(created.id);
      setNotice("Template created — edit it below and Save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the template.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const html = editorRef.current?.innerHTML ?? "";
      const patch = active.custom ? { name, description, html } : { name, html };
      const saved = await updateTemplate(active.id, patch);
      setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setNotice("Template saved. Delegates get this layout on their next new document.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!active) return;
    if (!window.confirm(`Reset "${active.name}" to the built-in default?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const restored = await resetTemplate(active.id);
      setTemplates((prev) => prev.map((t) => (t.id === restored.id ? restored : t)));
      setName(restored.name);
      setDescription(restored.description);
      if (editorRef.current) editorRef.current.innerHTML = restored.html;
      setNotice("Reset to the default template.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!active || !active.custom) return;
    if (!window.confirm(`Delete the custom template "${active.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteTemplate(active.id);
      const next = templates.filter((t) => t.id !== active.id);
      setTemplates(next);
      setActiveId(next[0]?.id ?? "");
      setNotice("Template deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (label: ReactNode, onClick: () => void, title: string, extra = "") => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm text-navy-700 hover:bg-navy-200 ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Template tabs + new */}
      <div className="flex flex-wrap items-center gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`badge px-3.5 py-2 ${t.id === activeId ? "bg-navy-800 text-white" : "border border-navy-200 bg-white text-navy-700 hover:border-navy-400"}`}
          >
            <DocumentIcon width={14} height={14} /> {t.name}
            {t.custom && <span className={`ml-1 rounded px-1 text-[10px] ${t.id === activeId ? "bg-white/20" : "bg-gold-100 text-gold-700"}`}>custom</span>}
          </button>
        ))}
        <button onClick={newTemplate} disabled={busy} className="badge border-2 border-dashed border-emerald-300 bg-emerald-50 px-3.5 py-2 text-emerald-700 hover:bg-emerald-100">
          <PlusIcon width={14} height={14} /> New template
        </button>
      </div>

      {active && (
        <div className="card !p-0">
          <div className="grid gap-3 border-b border-navy-100 px-5 py-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="label">Template name</label>
              <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input-field" placeholder={active.name} />
            </div>
            <div>
              <label htmlFor="tpl-desc" className="label">Description {active.custom ? "" : "(built-in)"}</label>
              <input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} disabled={!active.custom} className="input-field disabled:bg-navy-50 disabled:text-navy-400" />
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-navy-100 bg-navy-50/60 px-3 py-2">
            {TOOLBAR.map((t) => btn(t.label, () => exec(t.cmd, t.value), t.title, t.label === "B" ? "font-bold" : t.label === "I" ? "italic" : t.label === "U" ? "underline" : t.label === "S" ? "line-through" : ""))}
            <span className="mx-1 h-5 w-px bg-navy-200" />
            {btn("🖼", () => imgInputRef.current?.click(), "Insert image")}
            {btn("―", () => exec("insertHorizontalRule"), "Divider")}
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          </div>

          {/* Editable area */}
          <div ref={editorRef} contentEditable suppressContentEditableWarning className="doc-content min-h-[45vh] overflow-y-auto px-6 py-5" />

          <div className="flex flex-wrap items-center gap-3 border-t border-navy-100 px-5 py-3">
            <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
              <CheckIcon width={16} height={16} /> {busy ? "Saving…" : "Save template"}
            </button>
            {active.custom ? (
              <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                <TrashIcon width={15} height={15} /> Delete
              </button>
            ) : (
              <button onClick={reset} disabled={busy} className="btn-ghost">Reset to default</button>
            )}
            {notice && <span className="text-sm font-medium text-green-700">{notice}</span>}
            {error && <span className="text-sm font-medium text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
