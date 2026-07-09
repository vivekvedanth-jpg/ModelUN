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

function safeList(dir: string): string[] | null {
  try {
    return fs.existsSync(dir) ? fs.readdirSync(dir) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const cwd = process.cwd();
  const home = process.env.HOME || "";

  // domains/letsmun.com is 2 levels below the real account root on Hostinger
  // shared hosting (/home/u######). That account root is shared across every
  // site/service on the account, so a single site's git redeploy should never
  // touch it — the best candidate for truly persistent storage.
  const accountRoot = path.resolve(cwd, "..", "..", "..");

  const candidates = [
    path.join(cwd, "data"),
    path.resolve(cwd, "..", "persistent-data"),
    path.resolve(cwd, "..", "..", "persistent-data"),
    path.join(accountRoot, "persistent-data"),
    home ? path.join(home, "persistent-data") : "",
  ].filter(Boolean);

  return NextResponse.json({
    cwd,
    home,
    dirname: __dirname,
    accountRoot,
    listCwd: safeList(cwd),
    listParent: safeList(path.resolve(cwd, "..")),
    listGrandparent: safeList(path.resolve(cwd, "..", "..")),
    listAccountRoot: safeList(accountRoot),
    listHome: home ? safeList(home) : null,
    writeTests: candidates.map(tryWrite),
  });
}
