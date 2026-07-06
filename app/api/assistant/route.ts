import { type NextRequest, NextResponse } from "next/server";
import { isValidAssistantModel, DEFAULT_ASSISTANT_MODEL } from "@/lib/assistant";
import { getSessionUser, isGuestDoc, fail } from "@/lib/server/session";

// This route runs on the server, so GEMINI_API_KEY is never sent to the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the "MUN Assistant", an expert Model United Nations coach built into a learning platform for student delegates.

You help delegates by doing the work for them, not just explaining. You can:
- GENERATE speeches in full — opening speeches, General Speakers' List speeches, and closing remarks — for a given country and topic.
- DRAFT formal interventions on request: Points of Order, Points of Information, Points of Parliamentary Inquiry, Points of Personal Privilege, motions (e.g. to open a moderated/unmoderated caucus), and amendments.
- WRITE resolution clauses — preambulatory and operative — and improve drafts.
- ANSWER any question about rules of procedure, diplomacy, country positions, research, and conference strategy.

Style:
- When asked to generate something, produce the finished text directly, ready to deliver — don't just give tips unless tips are what's asked for.
- Be concise and practical. Use short paragraphs or bullet points and clear formatting.
- For speeches, include a strong hook, the country's position, supporting points, and a call to action.
- Phrase points and motions in correct parliamentary language (e.g. "Motion to...", "Point of Order, the delegate...").
- Assume a school/college MUN context. Keep content appropriate and educational.

Formatting rules (important):
- Do NOT use Markdown syntax. Never use asterisks — no "*" bullets and no "**" for bold.
- Use numbered lists ("1.", "2.", "3.") for ordered steps, speeches, or ranked points.
- Begin each item in an unordered list with a bullet character "• ".
- Write any headings as plain text on their own line (no "#"), and separate sections with a blank line.`;

interface IncomingMessage {
  from?: string;
  text?: string;
}

/**
 * Normalises model output to plain, readable text: Markdown bullets become
 * "• ", heading hashes are stripped, and asterisk emphasis is removed — so the
 * chat shows clean numbers and bullet points instead of "*" / "**".
 */
function cleanFormatting(text: string): string {
  const lines = text.split("\n").map((line) => {
    let l = line.replace(/^(\s*)[-*+]\s+/, "$1• "); // "- ", "* ", "+ " -> "• "
    l = l.replace(/^(\s*)#{1,6}\s+/, "$1"); // strip "#" headings
    return l;
  });
  return lines
    .join("\n")
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold** -> bold
    .replace(/__(.+?)__/g, "$1") // __bold__ -> bold
    .replace(/\*(.+?)\*/g, "$1") // *italic* -> italic
    .replace(/\*/g, "") // any stray asterisks
    .trim();
}

export async function POST(request: NextRequest) {
  // Signed-in, non-guest users only — every call spends real Gemini quota.
  const me = await getSessionUser(request);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the assistant.", 403);

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant isn't configured yet (missing GEMINI_API_KEY)." },
      { status: 500 }
    );
  }

  let payload: { messages?: IncomingMessage[]; model?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Admins can switch the model; the choice arrives in the request body. Use it
  // only if it's on the allowlist, otherwise fall back to the env default.
  const requestedModel =
    typeof payload.model === "string" ? payload.model : "";
  const model = isValidAssistantModel(requestedModel)
    ? requestedModel
    : process.env.GEMINI_MODEL || DEFAULT_ASSISTANT_MODEL;

  const messages = Array.isArray(payload.messages) ? payload.messages : [];

  // Map our chat history to Gemini's format, keep the last 20 turns for context.
  const contents = messages
    .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
    .slice(-20)
    .map((m) => ({
      role: m.from === "you" ? "user" : "model",
      parts: [{ text: m.text as string }],
    }));

  // Gemini requires the conversation to start with a user turn.
  while (contents.length > 0 && contents[0].role === "model") {
    contents.shift();
  }

  if (contents.length === 0) {
    return NextResponse.json({ error: "Please type a message first." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `Gemini request failed (${res.status}).`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      const blocked = data?.promptFeedback?.blockReason;
      return NextResponse.json(
        { error: blocked ? `Response blocked (${blocked}).` : "No response was generated." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: cleanFormatting(text) });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the AI service. Check your connection and try again." },
      { status: 502 }
    );
  }
}
