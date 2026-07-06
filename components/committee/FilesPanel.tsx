"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCommitteeFiles,
  getCommitteeFileWithData,
  uploadCommitteeFile,
  deleteCommitteeFile,
  MAX_COMMITTEE_FILE_BYTES,
  type CommitteeFile,
} from "@/lib/committee-files";
import { DocumentIcon, DownloadIcon, TrashIcon, UploadIcon } from "../icons";

function kindLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Image";
  if (mime === "text/plain") return "Text";
  if (mime.includes("word") || mime.includes("officedocument")) return "Doc";
  return "File";
}

function prettySize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64 = ""] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?)(;base64)?$/)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function FilesPanel({
  committeeId,
  canManage,
}: {
  committeeId: string;
  canManage: boolean;
}) {
  const [files, setFiles] = useState<CommitteeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Guard against a stale committee's response landing after a switch.
  const reqRef = useRef(0);

  useEffect(() => {
    const seq = ++reqRef.current;
    setLoading(true);
    setError("");
    getCommitteeFiles(committeeId)
      .then((list) => {
        if (reqRef.current === seq) setFiles(list);
      })
      .catch(() => {
        if (reqRef.current === seq) setError("Couldn't load documents.");
      })
      .finally(() => {
        if (reqRef.current === seq) setLoading(false);
      });
  }, [committeeId]);

  async function refresh() {
    const seq = ++reqRef.current;
    try {
      const list = await getCommitteeFiles(committeeId);
      if (reqRef.current === seq) setFiles(list);
    } catch {
      /* keep what we have */
    }
  }

  async function withData(id: string): Promise<{ blobUrl: string; name: string }> {
    const full = await getCommitteeFileWithData(id);
    const blob = dataUrlToBlob(full.dataUrl);
    return { blobUrl: URL.createObjectURL(blob), name: full.name };
  }

  async function download(f: CommitteeFile) {
    setError("");
    try {
      const { blobUrl, name } = await withData(f.id);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download.");
    }
  }

  async function view(f: CommitteeFile) {
    setError("");
    try {
      const { blobUrl } = await withData(f.id);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the file.");
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_COMMITTEE_FILE_BYTES) {
      setError("That file is over 4 MB — please choose a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await uploadCommitteeFile({
        committeeId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        dataUrl,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: CommitteeFile) {
    if (!window.confirm(`Delete "${f.name}" for everyone in this committee?`)) return;
    setError("");
    try {
      await deleteCommitteeFile(f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  }

  const canPreview = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

  return (
    <div className="flex flex-col rounded-2xl border border-navy-100 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-4 py-3">
        <h3 className="flex items-center gap-2 font-bold text-navy-900">
          <DocumentIcon width={18} height={18} /> Committee documents
        </h3>
        {canManage && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-gold !px-3 !py-1.5 text-xs disabled:opacity-60"
            >
              <UploadIcon width={14} height={14} /> {busy ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx,image/*,application/pdf,text/plain"
              className="hidden"
              onChange={onPick}
            />
          </>
        )}
      </div>

      <div className="min-h-[6rem] space-y-2 px-4 py-3">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="py-6 text-center text-sm text-navy-400">Loading documents…</p>
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-400">
            {canManage
              ? "No documents yet — upload the Rules of Procedure, a resolution format, or any guide your delegates need."
              : "No documents shared yet — the chair can upload the Rules of Procedure, format guides, and more."}
          </p>
        ) : (
          files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-600">
                <DocumentIcon width={16} height={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-navy-900">{f.name}</div>
                <div className="truncate text-xs text-navy-500">
                  {kindLabel(f.mime)} · {prettySize(f.size)} · {f.uploaderName}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {canPreview(f.mime) && (
                  <button
                    onClick={() => view(f)}
                    className="rounded-lg border border-navy-200 px-2 py-1 text-xs font-semibold text-navy-600 hover:bg-white"
                  >
                    View
                  </button>
                )}
                <button
                  onClick={() => download(f)}
                  aria-label={`Download ${f.name}`}
                  className="rounded-lg border border-navy-200 p-1.5 text-navy-600 hover:bg-white"
                >
                  <DownloadIcon width={15} height={15} />
                </button>
                {canManage && (
                  <button
                    onClick={() => remove(f)}
                    aria-label={`Delete ${f.name}`}
                    className="rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
