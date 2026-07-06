import { type NextRequest, NextResponse } from "next/server";
import { settingsCol } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, isGuestDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "doc_templates";
const MAX_NAME = 60;
const MAX_HTML = 200_000;

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

/** Built-in starting formats. Admins can override name/html per template. */
const DEFAULT_TEMPLATES: DocTemplate[] = [
  {
    id: "directive",
    name: "Directive",
    description: "Crisis directive — sponsors, type, and operative actions.",
    html: `<h1>Directive</h1>
<p><strong>Committee:</strong> </p>
<p><strong>Sponsors:</strong> </p>
<p><strong>Signatories:</strong> </p>
<p><strong>Type:</strong> Public / Private / Communiqué</p>
<h2>Operative Clauses</h2>
<ol>
<li><strong>Deploys</strong> … </li>
<li><strong>Authorizes</strong> … </li>
<li><strong>Requests</strong> … </li>
</ol>`,
  },
  {
    id: "resolution",
    name: "Resolution",
    description: "Full draft resolution with preambulatory & operative clauses.",
    html: `<h1>Resolution</h1>
<p><strong>FORUM:</strong> </p>
<p><strong>QUESTION OF:</strong> </p>
<p><strong>SUBMITTED BY:</strong> </p>
<p><strong>CO-SUBMITTED BY:</strong> </p>
<h2>Preambulatory Clauses</h2>
<ul>
<li><em>Recalling</em> … </li>
<li><em>Deeply concerned</em> by … </li>
<li><em>Noting with regret</em> … </li>
<li><em>Bearing in mind</em> … </li>
</ul>
<h2>Operative Clauses</h2>
<ol>
<li><u>Calls upon</u> all member states to …
<ol>
<li>through the establishment of …;</li>
<li>with particular regard to …;</li>
</ol>
</li>
<li><u>Urges</u> … </li>
<li><u>Requests</u> the Secretary-General to … </li>
</ol>`,
  },
  {
    id: "working-paper",
    name: "Working Paper",
    description: "Informal working paper to organise a bloc's ideas.",
    html: `<h1>Working Paper</h1>
<p><strong>Topic:</strong> </p>
<p><strong>Authors / Bloc:</strong> </p>
<h2>Problem Statement</h2>
<ul>
<li>… </li>
</ul>
<h2>Proposed Measures</h2>
<ul>
<li>… </li>
</ul>
<h2>Points for Further Discussion</h2>
<ul>
<li>… </li>
</ul>`,
  },
];

type Override = { name?: string; html?: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function readOverrides(): Promise<Record<string, Override>> {
  const doc = await (await settingsCol()).findOne({ key: SETTINGS_KEY });
  return isPlainObject(doc?.value) ? (doc!.value as Record<string, Override>) : {};
}

/** Apply stored overrides onto the defaults. */
function effective(overrides: Record<string, Override>): DocTemplate[] {
  return DEFAULT_TEMPLATES.map((t) => {
    const o = overrides[t.id];
    return o ? { ...t, name: o.name?.trim() || t.name, html: o.html ?? t.html } : t;
  });
}

/** GET — the effective templates (any signed-in non-guest user). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  const templates = effective(await readOverrides());
  return NextResponse.json({ templates });
}

/** PATCH — admin edits a template's name/html, or resets it to default. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Admins only.", 403);

  let body: { id?: string; name?: string; html?: string; reset?: boolean };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const base = DEFAULT_TEMPLATES.find((t) => t.id === body.id);
  if (!base) return fail("Unknown template.");

  const overrides = await readOverrides();

  if (body.reset) {
    delete overrides[base.id];
  } else {
    const next: Override = { ...overrides[base.id] };
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, MAX_NAME);
      if (name) next.name = name;
      else delete next.name;
    }
    if (body.html !== undefined) {
      if (typeof body.html !== "string") return fail("Invalid template body.");
      if (body.html.length > MAX_HTML) return fail("Template is too large.");
      next.html = body.html;
    }
    overrides[base.id] = next;
  }

  await (await settingsCol()).updateOne(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, value: overrides } },
    { upsert: true }
  );

  const merged = effective(overrides).find((t) => t.id === base.id)!;
  return NextResponse.json({ template: merged });
}
