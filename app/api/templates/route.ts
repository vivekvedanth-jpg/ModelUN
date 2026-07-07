import { type NextRequest, NextResponse } from "next/server";
import { settingsCol } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, isGuestDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Official-template name/html overrides, keyed by template id. */
const OVERRIDE_KEY = "doc_templates";
/** Admin-authored custom templates (full documents), stored as an array. */
const CUSTOM_KEY = "custom_templates";
const MAX_NAME = 60;
const MAX_DESC = 120;
const MAX_HTML = 400_000;

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
  /** True for admin-created templates (which can be deleted). */
  custom?: boolean;
}

function makeId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * A clean, recognisable UN-style emblem (polar-projection globe inside two
 * olive branches). Inlined so it prints in the PDF export and needs no network.
 */
const UN_EMBLEM = `<svg class="un-emblem" viewBox="0 0 200 210" width="82" height="86" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="United Nations emblem"><g fill="none" stroke="#1e3a5f" stroke-width="1.4"><circle cx="100" cy="86" r="54"/><circle cx="100" cy="86" r="40.5"/><circle cx="100" cy="86" r="27"/><circle cx="100" cy="86" r="13.5"/><line x1="100" y1="32" x2="100" y2="140"/><line x1="46" y1="86" x2="154" y2="86"/><line x1="62" y1="48" x2="138" y2="124"/><line x1="138" y1="48" x2="62" y2="124"/><ellipse cx="100" cy="86" rx="54" ry="21"/><ellipse cx="100" cy="86" rx="54" ry="40"/></g><g fill="#1e3a5f"><path d="M100 196 C74 190 44 168 34 132 l4-2 c11 34 40 55 62 61 z"/><path d="M100 196 C126 190 156 168 166 132 l-4-2 c-11 34-40 55-62 61 z"/><g><ellipse cx="42" cy="120" rx="7" ry="3.2" transform="rotate(38 42 120)"/><ellipse cx="52" cy="136" rx="7" ry="3.2" transform="rotate(30 52 136)"/><ellipse cx="66" cy="150" rx="7" ry="3.2" transform="rotate(22 66 150)"/><ellipse cx="82" cy="160" rx="7" ry="3.2" transform="rotate(12 82 160)"/></g><g><ellipse cx="158" cy="120" rx="7" ry="3.2" transform="rotate(-38 158 120)"/><ellipse cx="148" cy="136" rx="7" ry="3.2" transform="rotate(-30 148 136)"/><ellipse cx="134" cy="150" rx="7" ry="3.2" transform="rotate(-22 134 150)"/><ellipse cx="118" cy="160" rx="7" ry="3.2" transform="rotate(-12 118 160)"/></g></g></svg>`;

/** Built-in starting formats in the official UN layout. */
const DEFAULT_TEMPLATES: DocTemplate[] = [
  {
    id: "draft-resolution",
    name: "Draft Resolution",
    description: "Official UN General Assembly resolution — emblem, header, preamble & operative clauses.",
    html: `<div class="un-header" style="text-align:center">${UN_EMBLEM}<h1 style="text-align:center">General Assembly</h1><p style="text-align:center"><strong>Draft resolution</strong></p></div>
<hr>
<p><strong>Committee:</strong> </p>
<p><strong>Agenda item / Topic:</strong> </p>
<p><strong>Sponsors:</strong> </p>
<p><strong>Signatories:</strong> </p>
<p><em>The General Assembly</em>,</p>
<p class="mun-pre"><em>Recalling</em> its previous resolutions on the matter,</p>
<p class="mun-pre"><em>Reaffirming</em> the principles of the Charter of the United Nations,</p>
<p class="mun-pre"><em>Deeply concerned</em> by the ongoing situation,</p>
<p class="mun-pre"><em>Noting with regret</em> the lack of coordinated action,</p>
<ol class="mun-operative">
<li><u><strong>Calls upon</strong></u> all Member States to cooperate fully;</li>
<li><u><strong>Urges</strong></u> the relevant agencies to provide assistance;</li>
<li><u><strong>Requests</strong></u> the Secretary-General to report on the implementation of the present resolution.</li>
</ol>`,
  },
  {
    id: "position-paper",
    name: "Position Paper",
    description: "Country stance in UN style — delegation header, background, position, solutions.",
    html: `<div class="un-header" style="text-align:center">${UN_EMBLEM}<h1 style="text-align:center">Position Paper</h1></div>
<hr>
<p><strong>Committee:</strong> </p>
<p><strong>Country / Delegation:</strong> </p>
<p><strong>Delegate:</strong> </p>
<p><strong>Topic:</strong> </p>
<h2>I. Topic Background</h2>
<p>Summarise the issue, key facts, and why it matters to the international community.</p>
<h2>II. Country's Position</h2>
<p>State your delegation's official stance, citing past actions, treaties, and votes.</p>
<h2>III. Proposed Solutions</h2>
<ul>
<li>First proposed measure …</li>
<li>Second proposed measure …</li>
</ul>`,
  },
  {
    id: "crisis-directive",
    name: "Crisis Directive",
    description: "Crisis committee directive in UN style — routing header and operative actions.",
    html: `<div class="un-header" style="text-align:center">${UN_EMBLEM}<h1 style="text-align:center">Crisis Directive</h1></div>
<hr>
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
  const doc = await (await settingsCol()).findOne({ key: OVERRIDE_KEY });
  return isPlainObject(doc?.value) ? (doc!.value as Record<string, Override>) : {};
}

async function readCustom(): Promise<DocTemplate[]> {
  const doc = await (await settingsCol()).findOne({ key: CUSTOM_KEY });
  return Array.isArray(doc?.value) ? (doc!.value as DocTemplate[]) : [];
}

async function writeCustom(list: DocTemplate[]): Promise<void> {
  await (await settingsCol()).updateOne(
    { key: CUSTOM_KEY },
    { $set: { key: CUSTOM_KEY, value: list } },
    { upsert: true }
  );
}

/** Official templates with any stored overrides applied. */
function effectiveOfficial(overrides: Record<string, Override>): DocTemplate[] {
  return DEFAULT_TEMPLATES.map((t) => {
    const o = overrides[t.id];
    return o ? { ...t, name: o.name?.trim() || t.name, html: o.html ?? t.html } : t;
  });
}

/** GET — official templates + admin custom templates (any signed-in non-guest). */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (isGuestDoc(me)) return fail("Guest accounts can't use the editor.", 403);

  const [overrides, custom] = await Promise.all([readOverrides(), readCustom()]);
  const templates = [
    ...effectiveOfficial(overrides),
    ...custom.map((c) => ({ ...c, custom: true })),
  ];
  return NextResponse.json({ templates });
}

/** POST — admin creates a new custom template. */
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Admins only.", 403);

  let body: { name?: string; description?: string; html?: string };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) return fail("Give the template a name.");
  const description = String(body.description ?? "").trim().slice(0, MAX_DESC) || "Custom template.";
  const html = typeof body.html === "string" ? body.html : "";
  if (html.length > MAX_HTML) return fail("Template is too large.");

  const custom = await readCustom();
  const tpl: DocTemplate = { id: makeId(), name, description, html, custom: true };
  custom.push(tpl);
  await writeCustom(custom);
  return NextResponse.json({ template: tpl }, { status: 201 });
}

/** PATCH — edit an official template (override/reset) or a custom template. */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Admins only.", 403);

  let body: { id?: string; name?: string; description?: string; html?: string; reset?: boolean };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  const id = String(body.id ?? "");

  // Custom template — update the array entry.
  if (id.startsWith("custom-")) {
    const custom = await readCustom();
    const idx = custom.findIndex((t) => t.id === id);
    if (idx < 0) return fail("Unknown template.");
    if (body.name !== undefined) custom[idx].name = String(body.name).trim().slice(0, MAX_NAME) || custom[idx].name;
    if (body.description !== undefined) custom[idx].description = String(body.description).trim().slice(0, MAX_DESC);
    if (body.html !== undefined) {
      if (typeof body.html !== "string") return fail("Invalid template body.");
      if (body.html.length > MAX_HTML) return fail("Template is too large.");
      custom[idx].html = body.html;
    }
    await writeCustom(custom);
    return NextResponse.json({ template: { ...custom[idx], custom: true } });
  }

  // Official template — override or reset.
  const base = DEFAULT_TEMPLATES.find((t) => t.id === id);
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
    { key: OVERRIDE_KEY },
    { $set: { key: OVERRIDE_KEY, value: overrides } },
    { upsert: true }
  );
  const merged = effectiveOfficial(overrides).find((t) => t.id === base.id)!;
  return NextResponse.json({ template: merged });
}

/** DELETE ?id=custom-… — admin removes a custom template (officials can't be deleted). */
export async function DELETE(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!isAdminDoc(me)) return fail("Admins only.", 403);

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id.startsWith("custom-")) return fail("Only custom templates can be deleted.");

  const custom = await readCustom();
  const next = custom.filter((t) => t.id !== id);
  if (next.length !== custom.length) await writeCustom(next);
  return NextResponse.json({ ok: true });
}
