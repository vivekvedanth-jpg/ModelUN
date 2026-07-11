/** Shared, pure blog formatting helpers (safe on server and client). */

export function formatBlogDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A colour-cycling initial-based avatar background, keyed on the author name. */
export function authorAccent(name: string): string {
  const palette = [
    "bg-navy-800 text-gold-400",
    "bg-gold-500 text-navy-900",
    "bg-emerald-600 text-white",
    "bg-navy-600 text-white",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
