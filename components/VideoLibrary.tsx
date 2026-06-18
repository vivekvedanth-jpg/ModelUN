"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import { getVideos, deleteVideo, type Video } from "@/lib/content";
import UploadCard from "./UploadCard";
import { PlayIcon, TrashIcon } from "./icons";

function levelClass(level: string) {
  switch (level) {
    case "Beginner":
      return "bg-green-100 text-green-700";
    case "Intermediate":
      return "bg-gold-100 text-gold-700";
    default:
      return "bg-navy-100 text-navy-700";
  }
}

export default function VideoLibrary() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    setVideos(getVideos());
  }, []);

  function handleDelete(v: Video) {
    if (window.confirm(`Delete the video "${v.title}"?`)) {
      setVideos(deleteVideo(v.id));
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
            onAdded={() => setVideos(getVideos())}
          />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => {
          const card = (
            <>
              {/* Thumbnail */}
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
              {/* Body */}
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                  {v.category}
                </p>
                <h3 className="mt-1.5 font-bold text-navy-900">{v.title}</h3>
                {admin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(v);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    <TrashIcon width={15} height={15} /> Delete
                  </button>
                )}
              </div>
            </>
          );

          return v.url ? (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover group overflow-hidden !p-0"
            >
              {card}
            </a>
          ) : (
            <article key={v.id} className="card-hover group overflow-hidden !p-0">
              {card}
            </article>
          );
        })}
      </div>
    </>
  );
}
