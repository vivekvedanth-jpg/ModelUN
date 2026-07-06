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
    id: "position-paper",
    name: "Position Paper",
    description: "Country stance — background, position, and proposed solutions.",
    html: `<h1>Position Paper</h1>
<p><strong>Committee:</strong> </p>
<p><strong>Country:</strong> </p>
<p><strong>Delegate:</strong> </p>
<p><strong>Topic:</strong> </p>
<h2>Topic Background</h2>
<p>Briefly summarise the issue and why it matters to the international community.</p>
<h2>Country's Position</h2>
<p>State your country's official stance, citing past actions, treaties, or votes.</p>
<h2>Proposed Solutions</h2>
<ul>
<li>First proposed measure …</li>
<li>Second proposed measure …</li>
</ul>`,
  },
  {
    id: "draft-resolution",
    name: "Draft Resolution",
    description: "Full resolution with preambulatory & auto-numbered operative clauses.",
    html: `<h1>Draft Resolution</h1>
<p><strong>Committee:</strong> </p>
<p><strong>Sponsors:</strong> </p>
<p><strong>Signatories:</strong> </p>
<p><strong>Topic:</strong> </p>
<p><em>The General Assembly</em>,</p>
<p class="mun-pre"><em>Recalling</em> its previous resolutions on the matter,</p>
<p class="mun-pre"><em>Deeply concerned</em> by the ongoing situation,</p>
<p class="mun-pre"><em>Noting with regret</em> the lack of coordinated action,</p>
<ol class="mun-operative">
<li><u><strong>Calls upon</strong></u> all member states to cooperate fully;</li>
<li><u><strong>Urges</strong></u> the relevant agencies to provide assistance;</li>
<li><u><strong>Requests</strong></u> the Secretary-General to report on progress.</li>
</ol>`,
  },
  {
    id: "crisis-directive",
    name: "Crisis Directive",
    description: "Crisis committee directive — sponsors, type, and operative actions.",
    html: `<h1>Crisis Directive</h1>
<p><strong>Committee:</strong> </p>
<p><strong>From:</strong> </p>
<p><strong>To:</strong> </p>
<p><strong>Re:</strong> </p>
<p><strong>Type:</strong> Public / Private / Communiqué</p>
<ol class="mun-operative">
<li><u><strong>Authorizes</strong></u> the deployment of … ;</li>
<li><u><strong>Deploys</strong></u> the following assets … ;</li>
<li><u><strong>Requests</strong></u> immediate confirmation from … .</li>
</ol>`,
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
