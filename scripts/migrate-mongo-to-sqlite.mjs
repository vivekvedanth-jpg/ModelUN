/**
 * One-time migration: copy every collection from MongoDB Atlas into the local
 * SQLite database the app now uses.
 *
 * Usage (from the project root):
 *   MONGODB_URI="<your atlas uri>" node scripts/migrate-mongo-to-sqlite.mjs
 *
 * It reads MONGODB_URI / MONGODB_DB / SQLITE_PATH from the environment, falling
 * back to .env.local. SQLITE_PATH must be the SAME path the app uses (defaults
 * to ./data/mun.db). Re-running replaces the SQLite contents with a fresh copy.
 */
import { MongoClient } from "mongodb";
import initSqlJs from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load .env.local as a fallback for any missing vars.
try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
} catch { /* no .env.local — rely on real env */ }

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "mun";
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "mun.db");

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Provide your Atlas connection string, e.g.:\n  MONGODB_URI=\"mongodb+srv://…\" node scripts/migrate-mongo-to-sqlite.mjs");
  process.exit(1);
}

const COLLECTIONS = [
  "users", "groups", "experiences", "questions", "committees",
  "messages", "resources", "videos", "documents", "settings", "committee_files",
];

async function main() {
  console.log(`Source: MongoDB "${MONGODB_DB}"`);
  console.log(`Target: SQLite ${SQLITE_PATH}\n`);

  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (f) => require.resolve(`sql.js/dist/${f}`),
  });
  const existing = fs.existsSync(SQLITE_PATH) ? fs.readFileSync(SQLITE_PATH) : undefined;
  const sqlite = new SQL.Database(existing);

  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(MONGODB_DB);

  let total = 0;
  for (const name of COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray();
    sqlite.run(`CREATE TABLE IF NOT EXISTS "${name}" (rowid INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`);
    sqlite.run(`DELETE FROM "${name}"`); // fresh copy
    for (const d of docs) {
      delete d._id; // drop Mongo's internal id; the app uses its own string ids
      sqlite.run(`INSERT INTO "${name}" (data) VALUES (?)`, [JSON.stringify(d)]);
    }
    console.log(`  ${name.padEnd(16)} ${docs.length} document(s)`);
    total += docs.length;
  }

  await mongo.close();
  fs.writeFileSync(SQLITE_PATH, Buffer.from(sqlite.export()));
  sqlite.close();
  console.log(`\n✅ Migrated ${total} documents into ${SQLITE_PATH}`);
}

main().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
