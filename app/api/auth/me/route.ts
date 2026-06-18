import { type NextRequest, NextResponse } from "next/server";
import { toDetail } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    return NextResponse.json({ account: user ? toDetail(user) : null });
  } catch {
    // If the DB/env isn't configured yet, treat the visitor as signed out.
    return NextResponse.json({ account: null });
  }
}
