"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { canWriteBlog } from "@/lib/auth";
import {
  getMyPosts,
  createPost,
  updatePost,
  type BlogPost,
  type CommentPolicy,
} from "@/lib/blog";
import { downscaleImage } from "@/lib/editor-images";
import { CheckIcon, TrashIcon } from "./icons";

const iconSvg = (paths: ReactNode) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);
const AlignLeft = iconSvg(<><path d="M3 6h18" /><path d="M3 12h12" /><path d="M3 18h15" /></>);
const AlignCenter = iconSvg(<><path d="M3 6h18" /><path d="M6 12h12" /><path d="M4 18h16" /></>);
const LinkI = iconSvg(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>);
const ImageI = iconSvg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>);

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

export default function BlogEditor() {
  const { user, loading } = useAuth();
  const allowed = canWriteBlog(user);
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");

  const [ready, setReady] = useState(false);
  const [existing, setExisting] = useState<BlogPost | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>("signed-in");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Load an existing post when editing.
  useEffect(() => {
    if (loading || !allowed) return;
    if (!editId) { setReady(true); return; }
    getMyPosts()
      .then((posts) => {
        const p = posts.find((x) => x.id === editId) ?? null;
        setExisting(p);
        if (p) {
          setTitle(p.title);
          setTag(p.tag ?? "");
          setExcerpt(p.excerpt ?? "");
          setCoverImage(p.coverImage);
          setCommentPolicy(p.commentPolicy ?? "signed-in");
          if (editorRef.current) editorRef.current.innerHTML = p.html;
        }
      })
      .catch(() => setError("Couldn't load that post."))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allowed, editId]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  function insertLink() {
    const url = window.prompt("Link URL (https://…):", "https://");
    if (url) exec("createLink", url);
  }

  async function onPickBodyImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (imgInputRef.current) imgInputRef.current.value = "";
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file);
      editorRef.current?.focus();
      const img = `<img src="${dataUrl}" alt="" style="width:100%;margin:10px auto;display:block;" />`;
      document.execCommand("insertHTML", false, img);
    } catch {
      setError("Couldn't insert that image.");
    }
  }

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file) return;
    try {
      setCoverImage(await downscaleImage(file, 1600, 0.85));
    } catch {
      setError("Couldn't load that cover image.");
    }
  }

  async function save(publish: boolean) {
    setError("");
    setNotice("");
    if (!title.trim()) { setError("Please add a title."); return; }
    const html = editorRef.current?.innerHTML ?? "";
    if (!html.trim() || (editorRef.current?.textContent ?? "").trim() === "") {
      setError("Please write something before saving.");
      return;
    }
    setSaving(true);
    const payload = { title, html, tag: tag || undefined, excerpt: excerpt || undefined, coverImage, published: publish, commentPolicy };
    try {
      if (existing) {
        const updated = await updatePost(existing.id, payload);
        setExisting(updated);
        setNotice(publish ? "Published! Your changes are live." : "Draft saved.");
        if (publish) router.push(`/blog/${updated.slug}`);
      } else {
        const created = await createPost(payload);
        setExisting(created);
        setNotice(publish ? "Published!" : "Draft saved.");
        if (publish) router.push(`/blog/${created.slug}`);
        else router.replace(`/blog/write?id=${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the post.");
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !allowed) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-xl font-bold text-navy-900">Contributors only</h1>
          <p className="mt-2 text-navy-600">
            You don&apos;t have permission to write blog posts. Ask an admin to
            grant you access.
          </p>
          <Link href="/blog" className="btn-ghost mt-6 inline-flex">Back to the blog</Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="container-page py-20 text-navy-500">Loading…</div>;
  }

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/blog/manage" className="text-sm font-semibold text-navy-600 hover:text-navy-900">
          ← My posts
        </Link>
        <div className="flex items-center gap-2">
          {existing?.published && (
            <span className="badge bg-green-100 text-green-700">
              <CheckIcon width={12} height={12} /> Published
            </span>
          )}
          <button onClick={() => save(false)} disabled={saving} className="btn-ghost !px-4 !py-2 text-sm">
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button onClick={() => save(true)} disabled={saving} className="btn-gold !px-4 !py-2 text-sm">
            {existing?.published ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{notice}</p>}

      {/* Cover image */}
      <div className="mb-6">
        {coverImage ? (
          <div className="relative overflow-hidden rounded-2xl border border-navy-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="Cover" className="max-h-72 w-full object-cover" />
            <button
              onClick={() => setCoverImage(undefined)}
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-navy-900/80 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-900"
            >
              <TrashIcon width={13} height={13} /> Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => coverInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 py-10 text-sm font-semibold text-navy-500 hover:border-navy-400 hover:bg-navy-50"
          >
            {ImageI} Add a cover image
          </button>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onPickCover} />
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        className="w-full bg-transparent font-serif text-3xl font-bold text-navy-900 outline-none placeholder:text-silver-500 sm:text-4xl"
      />

      {/* Tag + excerpt */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <label className="label">Category (optional)</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Guides" className="input-field" />
        </div>
        <div>
          <label className="label">Short summary (optional)</label>
          <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One line shown on cards (auto-generated if left blank)" className="input-field" />
        </div>
      </div>

      {/* Comment policy */}
      <div className="mt-4 max-w-sm">
        <label className="label">Who can comment</label>
        <select
          value={commentPolicy}
          onChange={(e) => setCommentPolicy(e.target.value as CommentPolicy)}
          className="input-field"
        >
          <option value="signed-in">Signed-in users only</option>
          <option value="anyone">Anyone (including logged-out visitors)</option>
          <option value="off">No comments</option>
        </select>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-0.5 rounded-t-xl border border-navy-100 bg-navy-50/60 px-2 py-2">
        <TBtn onClick={() => exec("undo")} title="Undo">↶</TBtn>
        <TBtn onClick={() => exec("redo")} title="Redo">↷</TBtn>
        <Divider />
        <TBtn onClick={() => exec("bold")} title="Bold" className="font-bold">B</TBtn>
        <TBtn onClick={() => exec("italic")} title="Italic" className="italic">I</TBtn>
        <TBtn onClick={() => exec("underline")} title="Underline" className="underline">U</TBtn>
        <Divider />
        <TBtn onClick={() => exec("formatBlock", "h2")} title="Heading">H2</TBtn>
        <TBtn onClick={() => exec("formatBlock", "h3")} title="Subheading">H3</TBtn>
        <TBtn onClick={() => exec("formatBlock", "p")} title="Normal text">¶</TBtn>
        <TBtn onClick={() => exec("formatBlock", "blockquote")} title="Quote">❝</TBtn>
        <Divider />
        <TBtn onClick={() => exec("insertUnorderedList")} title="Bulleted list">•</TBtn>
        <TBtn onClick={() => exec("insertOrderedList")} title="Numbered list">1.</TBtn>
        <TBtn onClick={() => exec("justifyLeft")} title="Align left">{AlignLeft}</TBtn>
        <TBtn onClick={() => exec("justifyCenter")} title="Align centre">{AlignCenter}</TBtn>
        <Divider />
        <TBtn onClick={insertLink} title="Insert link">{LinkI}</TBtn>
        <TBtn onClick={() => imgInputRef.current?.click()} title="Insert image">{ImageI}</TBtn>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onPickBodyImage} />
      </div>

      {/* Body */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-empty="true"
        data-placeholder="Tell your story… Use the toolbar to add headings, quotes, lists, links, and images."
        onInput={(e) => {
          const el = e.currentTarget;
          el.dataset.empty = (el.textContent ?? "").trim() === "" && !el.querySelector("img") ? "true" : "false";
        }}
        className="doc-content blog-article min-h-[45vh] rounded-b-xl border border-t-0 border-navy-100 bg-white px-5 py-6 text-[1.05rem] leading-8 focus:outline-none"
      />

      <p className="mt-3 text-xs text-navy-500">
        Drafts are private to you and admins. Publishing makes the post visible to
        everyone on the blog.
      </p>
    </div>
  );
}
