/**
 * TEMPORARY diagnostic route — reports the server's filesystem layout so we
 * can find a folder that survives redeploys on Hostinger. Delete this file
 * once SQLITE_PATH is pinned to a confirmed-persistent location.
 */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryWrite(dir: string): { dir: string; writable: boolean; error?: string } {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe);
    return { dir, writable: true };
  } catch (err) {
    return { dir, writable: false, error: (err as Error).message };
  }
}

export async function GET() {
  const cwd = process.cwd();
  const home = process.env.HOME || "";

  const candidates = [
    path.join(cwd, "data"),
    path.resolve(cwd, "..", "persistent-data"),
    path.resolve(cwd, "..", "..", "persistent-data"),
    home ? path.join(home, "persistent-data") : "",
  ].filter(Boolean);

  return NextResponse.json({
    cwd,
    home,
    dirname: __dirname,
    listCwd: fs.existsSync(cwd) ? fs.readdirSync(cwd) : null,
    listParent: fs.existsSync(path.resolve(cwd, "..")) ? fs.readdirSync(path.resolve(cwd, "..")) : null,
    listHome: home && fs.existsSync(home) ? fs.readdirSync(home) : null,
    writeTests: candidates.map(tryWrite),
  });
}
