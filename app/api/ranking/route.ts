import { type NextRequest, NextResponse } from "next/server";
import { settingsCol, PLACEMENTS } from "@/lib/server/db";
import { getSessionUser, isAdminDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_POINTS: Record<string, number> = {
  "Best Delegate": 20,
  "Outstanding Delegate": 15,
  "Honorable Mention": 12,
  "Special Mention": 10,
  "Verbal Mention": 8,
  "Participant": 5,
  "Other / None": 2,
};

const MAX_POINTS = 1000;
const MAX_AWARD_NAME_CHARS = 40;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function getOrDefault<T>(key: string, fallback: T): Promise<T> {
  const col = await settingsCol();
  const doc = await col.findOne({ key });
  return doc ? (doc.value as T) : fallback;
}

async function upsert(key: string, value: unknown): Promise<void> {
  await (await settingsCol()).updateOne({ key }, { $set: { key, value } }, { upsert: true });
}

/** GET — returns { points, manualOrder, awardNames }. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const [points, manualOrder, awardNames] = await Promise.all([
    getOrDefault<Record<string, number>>("ranking_points", DEFAULT_POINTS),
    getOrDefault<string[]>("ranking_order", []),
    getOrDefault<Record<string, string>>("award_names", {}),
  ]);

  return NextResponse.json({ points, manualOrder, awardNames });
}

/** PATCH — update ranking settings (admin only). */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  let body: { action?: string; value?: unknown };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  switch (body.action) {
    case "set_points": {
      if (!isPlainObject(body.value)) return fail("Points must be an object.");
      const points: Record<string, number> = {};
      for (const [placement, raw] of Object.entries(body.value)) {
        if (!(PLACEMENTS as readonly string[]).includes(placement)) {
          return fail(`Unknown placement: ${placement}`);
        }
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
          return fail("Point values must be numbers.");
        }
        points[placement] = Math.min(MAX_POINTS, Math.max(0, raw));
      }
      await upsert("ranking_points", points);
      return NextResponse.json({ ok: true });
    }
    case "reset_points": {
      await upsert("ranking_points", DEFAULT_POINTS);
      return NextResponse.json({ points: DEFAULT_POINTS });
    }
    case "set_order": {
      if (!Array.isArray(body.value) || body.value.some((e) => typeof e !== "string")) {
        return fail("Order must be a list of emails.");
      }
      await upsert("ranking_order", body.value);
      return NextResponse.json({ ok: true });
    }
    case "clear_order": {
      await upsert("ranking_order", []);
      return NextResponse.json({ ok: true });
    }
    case "set_award_names": {
      if (!isPlainObject(body.value)) return fail("Award names must be an object.");
      const names: Record<string, string> = {};
      for (const [placement, raw] of Object.entries(body.value)) {
        if (!(PLACEMENTS as readonly string[]).includes(placement)) {
          return fail(`Unknown placement: ${placement}`);
        }
        if (typeof raw !== "string") return fail("Award names must be strings.");
        const name = raw.trim().slice(0, MAX_AWARD_NAME_CHARS).trim();
        // An empty name means "revert to the canonical name" — drop it.
        if (name) names[placement] = name;
      }
      await upsert("award_names", names);
      return NextResponse.json({ ok: true });
    }
    default:
      return fail(`Unknown action: ${body.action}`);
  }
}
