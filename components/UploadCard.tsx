"use client";

import { useState, type FormEvent } from "react";
import { addResource, addVideo } from "@/lib/content";
import { toEmbed } from "@/lib/embed";
import { UploadIcon, CheckIcon } from "./icons";

interface UploadCardProps {
  kind: "video" | "resource";
  title: string;
  description: string;
  /** Unused — entries link out to a URL. Kept so existing call sites compile. */
  accept?: string;
  cta: string;
  onAdded?: () => void;
  /** Existing category / subcategory names, for datalist suggestions (resources). */
  categories?: string[];
  subcategories?: string[];
}

export default function UploadCard({
  kind,
  title,
  description,
  cta,
  onAdded,
  categories = [],
  subcategories = [],
}: UploadCardProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setError("");

    try {
      if (kind === "video") {
        // Turn a pasted watch link / <iframe> code into a clean embeddable URL
        // so it plays inline; fall back to the raw text otherwise.
        const embed = toEmbed(url);
        await addVideo({ title: clean, url: embed.src || url.trim() || undefined });
      } else {
        await addResource({
          title: clean,
          url: url.trim() || undefined,
          category: category.trim() || undefined,
          subcategory: subcategory.trim() || undefined,
        });
      }
      setDone(true);
      setName("");
      setUrl("");
      setCategory("");
      setSubcategory("");
      onAdded?.();
      window.setTimeout(() => setDone(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border-2 border-dashed border-gold-300 bg-gold-50/60 p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-navy-900">
          <UploadIcon />
        </span>
        <div>
          <h3 className="font-bold text-navy-900">{title}</h3>
          <p className="text-sm text-navy-600">{description}</p>
        </div>
        <span className="badge ml-auto bg-gold-100 text-gold-700">Admin only</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          className="input-field"
          placeholder="Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-gold whitespace-nowrap">
          {cta}
        </button>
      </div>

      <input
        type="text"
        className="input-field mt-3"
        placeholder={
          kind === "video"
            ? "YouTube / Vimeo link, or paste an <iframe> embed code"
            : "Link (optional) — e.g. https://example.com/document.pdf"
        }
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <p className="mt-2 text-xs text-navy-500">
        {kind === "video"
          ? "Paste a YouTube or Vimeo link (or a full embed code) — the video then plays right inside the Videos page. A direct .mp4 link works too."
          : "Published entries link out to this URL — paste a link to where the resource is hosted."}
      </p>

      {kind === "resource" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <input
              type="text"
              list="resource-categories"
              className="input-field"
              placeholder="Category (e.g. Research)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="resource-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <input
              type="text"
              list="resource-subcategories"
              className="input-field"
              placeholder="Subcategory (e.g. Position Papers)"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            />
            <datalist id="resource-subcategories">
              {subcategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          <CheckIcon width={16} height={16} />
          Published! It now appears in the library below.
        </p>
      )}
    </form>
  );
}
