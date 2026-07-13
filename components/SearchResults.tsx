"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookIcon, PlayIcon, DocumentIcon, ArrowRightIcon } from "./icons";

interface SearchData {
  query: string;
  signedIn?: boolean;
  blogs: { slug: string; title: string; excerpt: string; tag?: string; authorName: string }[];
  videos: { title: string; category: string; level: string; url?: string }[];
  resources: { title: string; desc: string; type: string; category?: string; url?: string }[];
}

export default function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";

  const [input, setInput] = useState(q);
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput(q);
    if (!q.trim()) { setData(null); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = input.trim();
    router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  }

  const total = data ? data.blogs.length + data.videos.length + data.resources.length : 0;

  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="font-serif text-3xl font-bold text-navy-900">Search</h1>
      <form onSubmit={submit} className="mt-5 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search blog posts, videos, and resources…"
          className="input-field"
        />
        <button type="submit" className="btn-primary !px-6">Search</button>
      </form>

      {q && (
        <p className="mt-4 text-sm text-navy-500">
          {loading ? "Searching…" : `${total} result${total === 1 ? "" : "s"} for “${q}”`}
        </p>
      )}

      {data && !loading && (
        <div className="mt-8 space-y-10">
          {total === 0 && (
            <p className="text-navy-600">
              Nothing matched your search. Try different keywords.
            </p>
          )}

          {data.blogs.length > 0 && (
            <Group icon={<BookIcon width={18} height={18} />} label="Blog posts">
              {data.blogs.map((b) => (
                <Link key={b.slug} href={`/blog/${b.slug}`} className="block rounded-xl border border-navy-100 bg-white px-5 py-4 hover:border-gold-300 hover:shadow-sm">
                  {b.tag && <span className="text-xs font-semibold uppercase tracking-wide text-gold-600">{b.tag}</span>}
                  <h3 className="font-bold text-navy-900">{b.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-navy-600">{b.excerpt}</p>
                  <p className="mt-1 text-xs text-navy-400">By {b.authorName}</p>
                </Link>
              ))}
            </Group>
          )}

          {data.videos.length > 0 && (
            <Group icon={<PlayIcon width={18} height={18} />} label="Videos">
              {data.videos.map((v, i) => (
                <Link key={i} href="/videos" className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-5 py-4 hover:border-gold-300 hover:shadow-sm">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-navy-900">{v.title}</h3>
                    <p className="text-xs text-navy-500">{v.category} · {v.level}</p>
                  </div>
                  <ArrowRightIcon width={16} height={16} className="text-navy-400" />
                </Link>
              ))}
            </Group>
          )}

          {data.resources.length > 0 && (
            <Group icon={<DocumentIcon width={18} height={18} />} label="Resources">
              {data.resources.map((r, i) => (
                <Link key={i} href={r.url ?? "/resources"} target={r.url ? "_blank" : undefined} rel={r.url ? "noopener noreferrer" : undefined} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-5 py-4 hover:border-gold-300 hover:shadow-sm">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-navy-900">{r.title}</h3>
                    <p className="line-clamp-1 text-xs text-navy-500">{r.category ? `${r.category} · ` : ""}{r.desc}</p>
                  </div>
                  <ArrowRightIcon width={16} height={16} className="text-navy-400" />
                </Link>
              ))}
            </Group>
          )}

          {!data.signedIn && q && (
            <p className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-sm text-navy-600">
              <Link href="/signin" className="font-semibold underline">Sign in</Link> to also search videos and resources.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy-500">
        {icon} {label}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
