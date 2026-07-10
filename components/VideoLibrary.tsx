"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import { getVideos, deleteVideo, reorderVideos, type Video } from "@/lib/content";
import { toEmbed } from "@/lib/embed";
import UploadCard from "./UploadCard";
import { PlayIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "./icons";

function levelClass(level: string) {
  switch (level) {
    case "Beginner": return "bg-green-100 text-green-700";
    case "Intermediate": return "bg-gold-100 text-gold-700";
    default: return "bg-navy-100 text-navy-700";
  }
}

/** The inline player (YouTube/Vimeo iframe or a native <video>). */
function Player({ url, title }: { url: string; title: string }) {
  const embed = toEmbed(url);
  if (embed.type === "file") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={embed.src} controls autoPlay className="h-full w-full bg-black" />
    );
  }
  return (
    <iframe
      src={embed.src}
      title={title}
      allow="accelerated-download; autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className="h-full w-full border-0"
    />
  );
}

export default function VideoLibrary() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [videos, setVideos] = useState<Video[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => getVideos().then(setVideos).catch(() => {});

  useEffect(() => { refresh(); }, []);

  async function handleDelete(v: Video) {
    if (window.confirm(`Delete the video "${v.title}"?`)) {
      try {
        await deleteVideo(v.id);
        setVideos((prev) => prev.filter((x) => x.id !== v.id));
      } catch { /* ignore */ }
    }
  }

  /** Move a video one step earlier/later in the study plan (admin only). */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= videos.length || saving) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target], next[index]];
    setVideos(next); // optimistic
    setSaving(true);
    try {
      setVideos(await reorderVideos(next.map((v) => v.id)));
    } catch {
      refresh(); // roll back to the server's truth
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {admin && (
        <div className="mb-10">
          <UploadCard
            kind="video"
            title="Upload a new video"
            description="Add a lesson to the library for all delegates."
            accept="video/*"
            cta="Publish video"
            onAdded={refresh}
          />
        </div>
      )}

      {videos.length > 0 && (
        <div className="mb-6 rounded-xl border border-navy-100 bg-navy-50/60 px-5 py-3 text-sm text-navy-600">
          <span className="font-semibold text-navy-800">Your study plan.</span>{" "}
          Lessons are arranged in a recommended order — follow them top to bottom,
          or jump to whatever you need.
          {admin && " Use the arrows on each lesson to rearrange the plan."}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v, index) => {
          const embed = toEmbed(v.url);
          const canEmbed = embed.type !== "none";
          const isPlaying = playingId === v.id;

          const poster = (
            <div className="relative flex aspect-video items-center justify-center bg-navy-radial">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                <PlayIcon width={26} height={26} />
              </span>
              <span className={`badge absolute left-3 top-3 ${levelClass(v.level)}`}>
                {v.level}
              </span>
              <span className="absolute bottom-3 right-3 rounded-md bg-navy-950/80 px-2 py-1 font-mono text-xs font-semibold text-white">
                {v.duration}
              </span>
            </div>
          );

          const meta = (
            <div className="p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-600">
                <span className="inline-flex h-5 min-w-[2.75rem] items-center justify-center rounded-full bg-navy-800 px-2 text-[10px] text-white">
                  Step {index + 1}
                </span>
                {v.category}
              </p>
              <h3 className="mt-1.5 font-bold text-navy-900">{v.title}</h3>
              {admin && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); move(index, -1); }}
                      disabled={index === 0 || saving}
                      aria-label="Move earlier in the plan"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUpIcon width={14} height={14} />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); move(index, 1); }}
                      disabled={index === videos.length - 1 || saving}
                      aria-label="Move later in the plan"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDownIcon width={14} height={14} />
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(v); }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    <TrashIcon width={15} height={15} /> Delete
                  </button>
                </div>
              )}
            </div>
          );

          // Embeddable → play inline on click. Not embeddable but has a link →
          // open it. No URL → static card (nothing to play yet).
          if (canEmbed) {
            return (
              <article key={v.id} className="card-hover group overflow-hidden !p-0">
                {isPlaying ? (
                  <div className="aspect-video">
                    <Player url={v.url as string} title={v.title} />
                  </div>
                ) : (
                  <button
                    onClick={() => setPlayingId(v.id)}
                    className="block w-full text-left"
                    aria-label={`Play ${v.title}`}
                  >
                    {poster}
                  </button>
                )}
                {meta}
              </article>
            );
          }

          return v.url ? (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover group overflow-hidden !p-0"
            >
              {poster}
              {meta}
            </a>
          ) : (
            <article key={v.id} className="card-hover group overflow-hidden !p-0">
              {poster}
              {meta}
            </article>
          );
        })}
      </div>
    </>
  );
}
