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
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma("journal_mode = WAL");

  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(MONGODB_DB);

  let total = 0;
  for (const name of COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray();
    sqlite.exec(`CREATE TABLE IF NOT EXISTS "${name}" (rowid INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`);
    sqlite.prepare(`DELETE FROM "${name}"`).run(); // fresh copy
    const insert = sqlite.prepare(`INSERT INTO "${name}" (data) VALUES (?)`);
    const tx = sqlite.transaction((rows) => {
      for (const d of rows) {
        delete d._id; // drop Mongo's internal id; the app uses its own string ids
        insert.run(JSON.stringify(d));
      }
    });
    tx(docs);
    console.log(`  ${name.padEnd(16)} ${docs.length} document(s)`);
    total += docs.length;
  }

  await mongo.close();
  sqlite.close();
  console.log(`\n✅ Migrated ${total} documents into ${SQLITE_PATH}`);
}

main().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
