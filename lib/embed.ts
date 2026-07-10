/**
 * Turn whatever an admin pastes for a video — a YouTube/Vimeo link, a bare
 * embed URL, a direct .mp4, or a full `<iframe …>` snippet — into something we
 * can render inline. Falls back to "none" (link out) when it isn't embeddable.
 */
export interface EmbedInfo {
  /** "iframe" → render an <iframe>; "file" → <video>; "none" → not embeddable. */
  type: "iframe" | "file" | "none";
  src: string;
}

export function toEmbed(raw?: string | null): EmbedInfo {
  if (!raw) return { type: "none", src: "" };
  let url = raw.trim();

  // Someone pasted a full "<iframe … src="…">" embed snippet — pull the src.
  const iframeSrc = url.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeSrc) url = iframeSrc[1];

  // Protocol-relative (//…) → https.
  if (url.startsWith("//")) url = `https:${url}`;

  // A direct video file plays in a native <video> element.
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return { type: "file", src: url };

  // YouTube: watch, share, shorts, or already-embed links → the embed URL.
  const yt = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };

  // Vimeo.
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  // Anything that already looks like a player/embed URL → iframe as-is.
  if (/^https?:\/\//.test(url) && /(\/embed\/|\/embed$|player\.)/.test(url)) {
    return { type: "iframe", src: url };
  }

  // Otherwise we can't embed it — callers link out instead.
  return { type: "none", src: /^https?:\/\//.test(url) ? url : "" };
}

/** True when the pasted value can be shown in an in-page player. */
export function isEmbeddable(raw?: string | null): boolean {
  return toEmbed(raw).type !== "none";
}
