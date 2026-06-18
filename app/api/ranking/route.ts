import { type NextRequest, NextResponse } from "next/server";
import { settingsCol } from "@/lib/server/db";
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

async function getOrDefault<T>(key: string, fallback: T): Promise<T> {
  const col = await settingsCol();
  const doc = await col.findOne({ key });
  return doc ? (doc.value as T) : fallback;
}

async function upsert(key: string, value: unknown): Promise<void> {
  await (await settingsCol()).updateOne({ key }, { $set: { key, value } }, { upsert: true });
}

/** GET — returns { points, manualOrder }. */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);

  const [points, manualOrder] = await Promise.all([
    getOrDefault<Record<string, number>>("ranking_points", DEFAULT_POINTS),
    getOrDefault<string[]>("ranking_order", []),
  ]);

  return NextResponse.json({ points, manualOrder });
}

/** PATCH — update ranking settings (admin only). */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !isAdminDoc(me)) return fail("Admins only.", 403);

  let body: { action?: string; value?: unknown };
  try { body = await req.json(); } catch { return fail("Invalid body."); }

  switch (body.action) {
    case "set_points": {
      await upsert("ranking_points", body.value);
      return NextResponse.json({ ok: true });
    }
    case "reset_points": {
      await upsert("ranking_points", DEFAULT_POINTS);
      return NextResponse.json({ points: DEFAULT_POINTS });
    }
    case "set_order": {
      await upsert("ranking_order", body.value);
      return NextResponse.json({ ok: true });
    }
    case "clear_order": {
      await upsert("ranking_order", []);
      return NextResponse.json({ ok: true });
    }
    default:
      return fail(`Unknown action: ${body.action}`);
  }
}
