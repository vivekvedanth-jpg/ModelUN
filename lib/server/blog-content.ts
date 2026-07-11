/**
 * SERVER-ONLY helpers for blog content: sanitizing author HTML (the blog is
 * public, so this is a hard XSS boundary), building slugs, excerpts, and
 * reading-time estimates.
 */
import sanitizeHtml from "sanitize-html";

/**
 * Allowlist tuned to what the blog editor produces (execCommand-style rich
 * text). Anything else — scripts, event handlers, iframes, javascript: URLs —
 * is dropped. Inline images are allowed as data: URLs (the editor embeds them).
 */
export function sanitizeBlogHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr",
      "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "a", "img", "span", "div", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "style", "data-align", "class"],
      span: ["style"],
      div: ["style"],
      p: ["style", "class"],
      h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"],
      li: ["style"], ol: ["style", "class"], ul: ["style"],
      blockquote: ["style"],
      figure: ["style"], figcaption: ["style"],
    },
    // Only these inline style properties survive — no positioning/behaviour.
    allowedStyles: {
      "*": {
        "color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^[a-z- ]+$/],
        "font-family": [/^[\w\s,"'-]+$/],
        "width": [/^\d+(\.\d+)?(%|px)$/],
        "margin": [/^[\d.a-z% ]+$/],
        "float": [/^(left|right|none)$/],
        "display": [/^(block|inline|inline-block)$/],
      },
    },
    // Links: http/https/mailto only. Images: http/https + inline data URLs.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Force safe rel + open-in-new-tab on outbound links.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
}

/** A URL-safe slug from a title (letters, numbers, hyphens). */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "post";
}

/** Plain text from HTML (for excerpts + word counts). */
export function htmlToText(html: string): string {
  // Give block boundaries a space so "…Welcome</h2><p>A real…" doesn't collapse
  // into "WelcomeA real" once the tags are stripped.
  const spaced = html.replace(
    /(<\/(h[1-6]|p|div|li|blockquote|figcaption|ul|ol|tr)>|<br\s*\/?>)/gi,
    "$1 "
  );
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

/** A short excerpt from the body when the author didn't write one. */
export function deriveExcerpt(html: string, max = 180): string {
  const text = htmlToText(html);
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** Reading time in minutes (~200 wpm, minimum 1). */
export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
