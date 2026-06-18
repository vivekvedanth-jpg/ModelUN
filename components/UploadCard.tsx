"use client";

import { useState, type FormEvent } from "react";
import { addResource, addVideo } from "@/lib/content";
import { UploadIcon, CheckIcon } from "./icons";

interface UploadCardProps {
  kind: "video" | "resource";
  title: string;
  description: string;
  accept?: string;
  cta: string;
  onAdded?: () => void;
}

export default function UploadCard({
  kind,
  title,
  description,
  accept,
  cta,
  onAdded,
}: UploadCardProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setError("");

    try {
      if (kind === "video") {
        await addVideo({ title: clean, url: url.trim() || undefined });
      } else {
        await addResource({ title: clean, url: url.trim() || undefined });
      }
      setDone(true);
      setName("");
      setUrl("");
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
        type="url"
        className="input-field mt-3"
        placeholder="Link (optional) — e.g. https://example.com/document.pdf"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-600 hover:border-navy-400">
        <UploadIcon width={16} height={16} />
        <span className="ml-2">Choose a file{accept ? ` (${accept})` : ""}</span>
        <input type="file" accept={accept} className="hidden" />
      </label>

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
