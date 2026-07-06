"use client";

import { useEffect, useRef, useState } from "react";
import {
  getTemplates,
  updateTemplate,
  resetTemplate,
  type Template,
} from "@/lib/templates";
import { CheckIcon, DocumentIcon } from "./icons";

const TOOLBAR: { label: string; cmd: string; value?: string; title: string }[] = [
  { label: "B", cmd: "bold", title: "Bold" },
  { label: "I", cmd: "italic", title: "Italic" },
  { label: "U", cmd: "underline", title: "Underline" },
  { label: "H2", cmd: "formatBlock", value: "h2", title: "Heading" },
  { label: "¶", cmd: "formatBlock", value: "p", title: "Normal text" },
  { label: "• List", cmd: "insertUnorderedList", title: "Bulleted list" },
  { label: "1. List", cmd: "insertOrderedList", title: "Numbered list" },
  { label: "⌫ Clear", cmd: "removeFormat", title: "Clear formatting" },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

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
    if (editorRef.current) editorRef.current.innerHTML = active.html;
    setNotice("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const html = editorRef.current?.innerHTML ?? "";
      const saved = await updateTemplate(active.id, { name, html });
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
      if (editorRef.current) editorRef.current.innerHTML = restored.html;
      setNotice("Reset to the default template.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Template tabs */}
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`badge px-3.5 py-2 ${
              t.id === activeId
                ? "bg-navy-800 text-white"
                : "border border-navy-200 bg-white text-navy-700 hover:border-navy-400"
            }`}
          >
            <DocumentIcon width={14} height={14} /> {t.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="card !p-0">
          <div className="border-b border-navy-100 px-5 py-4">
            <label htmlFor="tpl-name" className="label">Template name</label>
            <input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="input-field"
              placeholder={active.name}
            />
            <p className="mt-2 text-xs text-navy-500">
              Delegates get this layout when they start a new {active.name.toLowerCase()}.
            </p>
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
            className="doc-content min-h-[45vh] overflow-y-auto px-6 py-5"
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-navy-100 px-5 py-3">
            <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
              <CheckIcon width={16} height={16} /> {busy ? "Saving…" : "Save template"}
            </button>
            <button onClick={reset} disabled={busy} className="btn-ghost">
              Reset to default
            </button>
            {notice && <span className="text-sm font-medium text-green-700">{notice}</span>}
            {error && <span className="text-sm font-medium text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
