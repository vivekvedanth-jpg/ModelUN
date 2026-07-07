/**
 * MUN drafting engine for the resolution editor.
 *
 * Pure helpers (phrase detection, punctuation, linting) are unit-testable in
 * Node; the DOM functions run only in the browser (contentEditable). Everything
 * is defensive — a formatting pass must never throw into the typing path.
 */

/* ─────────────────────────── Phrase dictionaries ─────────────────────────── */

/** Standard preambulatory phrases (clauses that end with a comma, italicised). */
export const PREAMBULATORY_PHRASES: string[] = [
  "Acknowledging", "Affirming", "Alarmed by", "Approving", "Aware of",
  "Bearing in mind", "Believing", "Confident", "Contemplating", "Convinced",
  "Declaring", "Deeply concerned", "Deeply conscious", "Deeply convinced",
  "Deeply disturbed", "Deeply regretting", "Desiring", "Emphasizing",
  "Expecting", "Expressing its appreciation", "Expressing its satisfaction",
  "Fulfilling", "Fully aware", "Fully alarmed", "Fully believing",
  "Further deploring", "Further recalling", "Guided by", "Having adopted",
  "Having considered", "Having examined", "Having received", "Having studied",
  "Keeping in mind", "Mindful", "Noting with deep concern",
  "Noting with regret", "Noting with satisfaction", "Noting further",
  "Noting", "Observing", "Reaffirming", "Realizing", "Recalling",
  "Recognizing", "Referring", "Seeking", "Taking into account",
  "Taking into consideration", "Taking note", "Viewing with appreciation",
  "Welcoming", "Concerned",
];

/** Standard operative phrases (numbered clauses, bold + underlined). */
export const OPERATIVE_PHRASES: string[] = [
  "Accepts", "Affirms", "Approves", "Authorizes", "Calls upon", "Calls",
  "Condemns", "Confirms", "Congratulates", "Considers", "Declares accordingly",
  "Deplores", "Designates", "Draws the attention", "Emphasizes", "Encourages",
  "Endorses", "Expresses its appreciation", "Expresses its hope",
  "Further invites", "Further proclaims", "Further recommends",
  "Further reminds", "Further requests", "Further resolves", "Invites",
  "Notes", "Proclaims", "Reaffirms", "Recommends", "Recognizes", "Regrets",
  "Reminds", "Requests", "Resolves", "Solemnly affirms", "Strongly condemns",
  "Supports", "Takes note of", "Transmits", "Trusts", "Urges", "Welcomes",
];

/**
 * Binding language reserved for the Security Council — flagged in
 * "General Assembly Mode" because the GA can only recommend, not compel.
 */
export const SC_BINDING_PHRASES: string[] = ["Decides", "Demands"];

/* ───────────────────────────── Pure helpers ─────────────────────────────── */

export type ClauseType = "pre" | "op" | "binding" | null;

/** Escape text for safe innerHTML insertion. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Longest-match-first so "Deeply concerned" wins over any shorter prefix. */
function byLengthDesc(a: string, b: string): number {
  return b.length - a.length;
}

/**
 * If `text` begins (case-insensitively) with one of `phrases`, return the
 * canonical phrase plus the remainder. The next character after the phrase must
 * be a word boundary so "Note" doesn't swallow "Notething".
 */
export function startsWithPhrase(
  text: string,
  phrases: string[]
): { phrase: string; rest: string } | null {
  const trimmed = text.replace(/^\s+/, "");
  const lower = trimmed.toLowerCase();
  for (const phrase of [...phrases].sort(byLengthDesc)) {
    const p = phrase.toLowerCase();
    if (lower.startsWith(p)) {
      const after = trimmed.charAt(phrase.length);
      if (after === "" || /[\s,;:.]/.test(after)) {
        return { phrase, rest: trimmed.slice(phrase.length) };
      }
    }
  }
  return null;
}

/** Classify a clause by its opening phrase. */
export function classifyClause(text: string): ClauseType {
  if (startsWithPhrase(text, SC_BINDING_PHRASES)) return "binding";
  if (startsWithPhrase(text, OPERATIVE_PHRASES)) return "op";
  if (startsWithPhrase(text, PREAMBULATORY_PHRASES)) return "pre";
  return null;
}

/** Strip trailing clause punctuation/space so we can re-apply the right mark. */
export function stripTrailingPunct(s: string): string {
  return s.replace(/[\s,;.]+$/, "");
}

export interface LintWarning {
  severity: "warning" | "info";
  message: string;
}

/* ─────────────────────────────── DOM layer ──────────────────────────────── */

/** True for block elements we treat as a single clause. */
function isClauseBlock(el: Element): boolean {
  return /^(P|DIV|H1|H2|H3|BLOCKQUOTE)$/.test(el.tagName);
}

/** The visible, collapsed text of an element. */
function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Rewrite one clause element's inner HTML: wrap its opening phrase, keep the
 * remaining words, and apply the given trailing punctuation. Rebuilding from
 * textContent guarantees correct wrapping (any inline styling inside the clause
 * body is normalised away — expected for a "format" action).
 */
function renderClause(text: string, type: "pre" | "op", punct: string): string {
  const phrases = type === "pre" ? PREAMBULATORY_PHRASES : OPERATIVE_PHRASES;
  const match = startsWithPhrase(text, phrases);
  if (!match) {
    return escapeHtml(stripTrailingPunct(text.trim())) + punct;
  }
  const body = stripTrailingPunct(match.rest);
  const wrapped =
    type === "pre"
      ? `<em>${escapeHtml(match.phrase)}</em>`
      : `<u><strong>${escapeHtml(match.phrase)}</strong></u>`;
  return `${wrapped}${escapeHtml(body)}${punct}`;
}

/** True if the element holds media we must not rebuild away (images, SVG). */
function hasMedia(el: Element): boolean {
  return !!el.querySelector("img, svg");
}

/** Format a single block in place (used for the light on-Enter pass). */
export function formatClauseBlock(el: Element): ClauseType {
  if (hasMedia(el)) return null; // never rebuild a block that contains a picture
  const text = textOf(el);
  if (!text) return null;
  const type = classifyClause(text);
  if (type === "pre") {
    el.innerHTML = renderClause(text, "pre", ",");
  } else if (type === "op" || type === "binding") {
    el.innerHTML = renderClause(text, "op", ";");
  }
  return type;
}

export interface FormatResult {
  warnings: LintWarning[];
  operativeCount: number;
  preambulatoryCount: number;
}

/**
 * Full normalisation pass over the editor root:
 *  - italicises preambulatory phrases, ends them with a comma;
 *  - bold+underlines operative phrases; consecutive loose operative paragraphs
 *    are grouped into one <ol class="mun-operative"> so they auto-number;
 *  - existing <ol> operative lists are formatted in place;
 *  - the final operative clause ends with "." and the rest with ";";
 *  - collects lint warnings (Security-Council binding language in GA mode).
 *
 * Never throws: on any error it returns the warnings gathered so far.
 */
export function formatDocument(
  root: HTMLElement,
  opts: { gaMode: boolean }
): FormatResult {
  const warnings: LintWarning[] = [];
  const opClauses: HTMLElement[] = []; // every operative <li> / clause, in order
  let preCount = 0;

  try {
    const doc = root.ownerDocument;
    const children = Array.from(root.children);
    const out: Node[] = [];
    let opBuffer: { text: string; el: Element }[] = [];

    const flushBuffer = () => {
      if (opBuffer.length === 0) return;
      const ol = doc.createElement("ol");
      ol.className = "mun-operative";
      for (const item of opBuffer) {
        const li = doc.createElement("li");
        li.innerHTML = renderClause(item.text, "op", ";");
        ol.appendChild(li);
        opClauses.push(li);
      }
      out.push(ol);
      opBuffer = [];
    };

    for (const el of children) {
      // Already an ordered list — format each item, keep the structure/nesting.
      if (el.tagName === "OL") {
        flushBuffer();
        el.querySelectorAll("li").forEach((li) => {
          if (hasMedia(li)) return; // don't rebuild a clause that contains a picture
          // Only the direct text of this li (ignore nested list text) decides type.
          const liText = directText(li);
          const type = classifyClause(liText);
          if (type === "op" || type === "binding") {
            replaceDirectText(li, renderClause(liText, "op", ";"));
            opClauses.push(li);
          } else if (type === "pre") {
            replaceDirectText(li, renderClause(liText, "pre", ","));
          }
        });
        if (!el.classList.contains("mun-operative")) el.classList.add("mun-operative");
        out.push(el);
        continue;
      }

      if (isClauseBlock(el) && !hasMedia(el)) {
        const text = textOf(el);
        const type = classifyClause(text);
        if (type === "op" || type === "binding") {
          opBuffer.push({ text, el });
          continue;
        }
        flushBuffer();
        if (type === "pre") {
          preCount++;
          const p = doc.createElement("p");
          p.className = "mun-pre";
          p.innerHTML = renderClause(text, "pre", ",");
          out.push(p);
          continue;
        }
      }

      // Anything else (headings, metadata, blank lines) passes through.
      flushBuffer();
      out.push(el);
    }
    flushBuffer();

    // Rebuild the editor content.
    root.replaceChildren(...out);

    // Final operative clause ends with a period; all others a semicolon.
    if (opClauses.length > 0) {
      const last = opClauses[opClauses.length - 1];
      setTrailingPunct(last, ".");
    }

    // Lint: Security-Council binding language when in GA mode.
    if (opts.gaMode) {
      for (const li of opClauses) {
        const m = startsWithPhrase(directText(li), SC_BINDING_PHRASES);
        if (m) {
          warnings.push({
            severity: "warning",
            message: `"${m.phrase}" is binding Security-Council language — the General Assembly can only recommend. Use "Recommends", "Urges" or "Calls upon" instead.`,
          });
        }
      }
    }
    if (opClauses.length === 0) {
      warnings.push({ severity: "info", message: "No operative clauses detected yet. Start a line with a phrase like “Calls upon” or “Urges”." });
    }
  } catch {
    /* leave the document untouched-ish; return what we have */
  }

  return { warnings, operativeCount: opClauses.length, preambulatoryCount: preCount };
}

/** Text of an element excluding any nested list content. */
function directText(el: Element): string {
  let s = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) s += n.textContent ?? "";
    else if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName !== "OL" && (n as Element).tagName !== "UL") {
      s += (n as Element).textContent ?? "";
    }
  });
  return s.replace(/\s+/g, " ").trim();
}

/** Replace an element's direct (non-nested-list) content with new HTML, keeping any nested list. */
function replaceDirectText(el: Element, html: string): void {
  const nestedLists: Node[] = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE && ((n as Element).tagName === "OL" || (n as Element).tagName === "UL")) {
      nestedLists.push(n);
    }
  });
  el.innerHTML = html;
  for (const list of nestedLists) el.appendChild(list);
}

/** Set the trailing punctuation of an element's last text node. */
function setTrailingPunct(el: Element, punct: string): void {
  // Find the deepest last text node that isn't inside a nested list.
  const walkLast = (node: Node): Text | null => {
    const kids = Array.from(node.childNodes).filter(
      (n) => !(n.nodeType === Node.ELEMENT_NODE && ((n as Element).tagName === "OL" || (n as Element).tagName === "UL"))
    );
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      if (k.nodeType === Node.TEXT_NODE && (k.textContent ?? "").trim() !== "") return k as Text;
      if (k.nodeType === Node.ELEMENT_NODE) {
        const found = walkLast(k);
        if (found) return found;
      }
    }
    return null;
  };
  const tn = walkLast(el);
  if (tn) tn.textContent = stripTrailingPunct(tn.textContent ?? "") + punct;
}

/* ───────────────────────── Caret save / restore ─────────────────────────── */

/** Count text characters before the caret within `root` (or null if no caret). */
export function saveCaret(root: HTMLElement): number | null {
  const sel = root.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Place the caret `offset` characters into `root` (clamped to its length). */
export function restoreCaret(root: HTMLElement, offset: number | null): void {
  if (offset == null) return;
  try {
    const sel = root.ownerDocument.getSelection();
    if (!sel) return;
    let remaining = offset;
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    let target: Text | null = null;
    let targetOffset = 0;
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        target = node;
        targetOffset = remaining;
        break;
      }
      remaining -= len;
      target = node;
      targetOffset = len;
      node = walker.nextNode() as Text | null;
    }
    const range = root.ownerDocument.createRange();
    if (target) {
      range.setStart(target, Math.min(targetOffset, target.textContent?.length ?? 0));
    } else {
      range.selectNodeContents(root);
      range.collapse(false);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* caret restore is best-effort */
  }
}
