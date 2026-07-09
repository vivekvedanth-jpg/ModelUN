/**
 * SERVER-ONLY embedded document store backed by SQLite (sql.js — SQLite
 * compiled to WebAssembly).
 *
 * It exposes a tiny document-store subset (findOne/find/insertOne/updateOne/
 * updateMany/deleteOne/deleteMany/countDocuments/createIndex). Each collection
 * is a SQLite table `(rowid, data JSON)`; documents are plain JSON. (The query
 * and update operators intentionally mirror a familiar `$set`/`$or`/… syntax so
 * the API routes read naturally.)
 *
 * sql.js is deliberately used instead of a native module (e.g. better-sqlite3):
 * it's pure WASM, so there's no node-gyp/C++ compile step and no Node-version
 * constraint — it just works on any host, including shared hosting without a
 * build toolchain. The whole database lives in memory and is flushed to a
 * single file on disk after each write (fine at our scale).
 *
 * All access goes through a per-process write queue (see `withDb`) so
 * concurrent request handlers never interleave reads/writes — every store
 * operation is atomic, same guarantee the previous better-sqlite3 version had.
 *
 * The query/update helpers below are pure (no I/O) and unit-tested separately.
 */

import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Resolve modules relative to THIS file, not the process cwd. On a host that
// starts the app from a different directory (common on shared/managed hosting),
// cwd-based lookups miss node_modules and sql.js fails to load its .wasm — which
// is exactly what surfaced as the "can't open the database" 503 on login.
const requireFromHere = createRequire(import.meta.url);

/* ─────────────────────────── Pure query engine ──────────────────────────── */

type Doc = Record<string, unknown>;
type Filter = Record<string, unknown>;
type Update = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof RegExp);
}

/** Dotted-path resolution: descending into an array applies the field to each element. */
function getCandidates(doc: unknown, dottedPath: string): unknown[] {
  let current: unknown[] = [doc];
  for (const part of dottedPath.split(".")) {
    const next: unknown[] = [];
    for (const node of current) {
      if (node == null) continue;
      if (Array.isArray(node)) {
        for (const el of node) {
          if (el != null && typeof el === "object" && part in (el as object)) {
            next.push((el as Record<string, unknown>)[part]);
          }
        }
      } else if (typeof node === "object" && part in (node as object)) {
        next.push((node as Record<string, unknown>)[part]);
      }
    }
    current = next;
  }
  return current;
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

/** Evaluate a field spec (value, RegExp, or {$ne,$lte,…}) against candidate values. */
function matchValue(candidates: unknown[], spec: unknown): boolean {
  if (spec instanceof RegExp) {
    return candidates.some((v) => typeof v === "string" && spec.test(v));
  }
  if (isPlainObject(spec) && Object.keys(spec).some((k) => k.startsWith("$"))) {
    for (const [op, arg] of Object.entries(spec)) {
      switch (op) {
        case "$ne":
          if (candidates.some((v) => eq(v, arg))) return false;
          break;
        case "$eq":
          if (!candidates.some((v) => eq(v, arg))) return false;
          break;
        case "$lte":
          if (!candidates.some((v) => (v as number) <= (arg as number))) return false;
          break;
        case "$lt":
          if (!candidates.some((v) => (v as number) < (arg as number))) return false;
          break;
        case "$gte":
          if (!candidates.some((v) => (v as number) >= (arg as number))) return false;
          break;
        case "$gt":
          if (!candidates.some((v) => (v as number) > (arg as number))) return false;
          break;
        case "$in":
          if (!candidates.some((v) => (arg as unknown[]).some((x) => eq(v, x)))) return false;
          break;
        case "$nin":
          if (candidates.some((v) => (arg as unknown[]).some((x) => eq(v, x)))) return false;
          break;
        case "$exists":
          if ((candidates.length > 0) !== !!arg) return false;
          break;
        case "$regex": {
          const flags = typeof (spec as Record<string, unknown>).$options === "string" ? (spec as Record<string, string>).$options : "";
          const re = new RegExp(arg as string, flags);
          if (!candidates.some((v) => typeof v === "string" && re.test(v))) return false;
          break;
        }
        case "$options":
          break; // handled with $regex
        default:
          throw new Error(`Unsupported query operator: ${op}`);
      }
    }
    return true;
  }
  // Plain equality.
  return candidates.some((v) => eq(v, spec));
}

/** True if `doc` satisfies `filter` (supports $or/$and, dotted paths, operators, RegExp). */
export function matchesFilter(doc: Doc, filter: Filter): boolean {
  for (const [key, spec] of Object.entries(filter)) {
    if (key === "$or") {
      if (!(spec as Filter[]).some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === "$and") {
      if (!(spec as Filter[]).every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (!matchValue(getCandidates(doc, key), spec)) return false;
  }
  return true;
}

/* ─────────────────────────── Pure update engine ─────────────────────────── */

function setPath(obj: Doc, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split(".");
  let node: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(node[p])) node[p] = {};
    node = node[p] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

function unsetPath(obj: Doc, dottedPath: string): void {
  const parts = dottedPath.split(".");
  let node: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(node[p])) return;
    node = node[p] as Record<string, unknown>;
  }
  delete node[parts[parts.length - 1]];
}

function pushField(obj: Doc, field: string, spec: unknown): void {
  let arr = Array.isArray(obj[field]) ? (obj[field] as unknown[]) : [];
  if (isPlainObject(spec) && "$each" in spec) {
    arr = arr.concat(spec.$each as unknown[]);
    const slice = (spec as Record<string, unknown>).$slice;
    if (typeof slice === "number") {
      arr = slice < 0 ? arr.slice(slice) : arr.slice(0, slice);
    }
  } else {
    arr.push(spec);
  }
  obj[field] = arr;
}

function pullMatches(el: unknown, match: unknown): boolean {
  if (isPlainObject(match)) {
    return Object.entries(match).every(([k, v]) => (el as Record<string, unknown>)?.[k] === v);
  }
  return eq(el, match);
}

function pullField(obj: Doc, field: string, match: unknown): void {
  if (Array.isArray(obj[field])) {
    obj[field] = (obj[field] as unknown[]).filter((el) => !pullMatches(el, match));
  }
}

/** Apply update operators ($set/$push/$inc/…) to a clone of `doc`, returning the new doc. */
export function applyUpdate(doc: Doc, update: Update): Doc {
  if (Array.isArray(update)) {
    throw new Error("Aggregation-pipeline updates are not supported by the SQLite store.");
  }
  const out: Doc = JSON.parse(JSON.stringify(doc));
  for (const [op, arg] of Object.entries(update)) {
    switch (op) {
      case "$set":
        for (const [p, v] of Object.entries(arg as Doc)) setPath(out, p, v);
        break;
      case "$unset":
        for (const p of Object.keys(arg as Doc)) unsetPath(out, p);
        break;
      case "$push":
        for (const [f, s] of Object.entries(arg as Doc)) pushField(out, f, s);
        break;
      case "$pull":
        for (const [f, m] of Object.entries(arg as Doc)) pullField(out, f, m);
        break;
      case "$setOnInsert":
        break; // only relevant on insert (handled by buildUpsertDoc)
      case "$inc":
        for (const [p, n] of Object.entries(arg as Record<string, number>)) {
          const parts = p.split(".");
          let node: Record<string, unknown> = out;
          for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] ?? {}) as Record<string, unknown>;
          const cur = node[parts[parts.length - 1]];
          setPath(out, p, (typeof cur === "number" ? cur : 0) + n);
        }
        break;
      default:
        throw new Error(`Unsupported update operator: ${op}`);
    }
  }
  return out;
}

/** Build the document to insert when an upsert matches nothing. */
export function buildUpsertDoc(filter: Filter, update: Update): Doc {
  const base: Doc = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith("$")) continue;
    if (v instanceof RegExp || isPlainObject(v)) continue; // operator/regex specs don't seed values
    setPath(base, k, v);
  }
  if (isPlainObject((update as Doc).$setOnInsert)) {
    for (const [k, v] of Object.entries((update as Doc).$setOnInsert as Doc)) setPath(base, k, v);
  }
  const rest = { ...update };
  delete (rest as Doc).$setOnInsert;
  return applyUpdate(base, rest);
}

/* ────────────────────────────── SQLite store ────────────────────────────── */

export interface WriteResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  upsertedId: number | null;
}

export interface DeleteResult { deletedCount: number }

export interface Cursor<T> { toArray(): Promise<T[]> }

export interface StoreCollection<T> {
  findOne(filter?: Filter): Promise<T | null>;
  find(filter?: Filter): Cursor<T>;
  insertOne(doc: T): Promise<{ insertedId: number }>;
  insertMany(docs: T[]): Promise<void>;
  updateOne(filter: Filter, update: Update, options?: { upsert?: boolean }): Promise<WriteResult>;
  updateMany(filter: Filter, update: Update): Promise<WriteResult>;
  deleteOne(filter: Filter): Promise<DeleteResult>;
  deleteMany(filter: Filter): Promise<DeleteResult>;
  countDocuments(filter?: Filter): Promise<number>;
  createIndex(): Promise<void>;
  /**
   * Insert `doc` only if nothing matches `filter`, as one atomic locked step.
   * Returns true if it inserted. Use this instead of findOne-then-insertOne,
   * which races across worker processes.
   */
  insertIfMissing(filter: Filter, doc: T): Promise<boolean>;
  /**
   * Atomic read-modify-write. `mutator` receives the first matching doc and
   * returns the replacement (or null to leave it unchanged). Runs entirely
   * synchronously, so concurrent callers can never interleave — use this for
   * the genuinely concurrent updates (votes, reactions).
   */
  mutate(filter: Filter, mutator: (doc: T) => T | null): Promise<T | null>;
}

/**
 * Absolute path to the database file.
 *
 * Order of preference:
 *  1. SQLITE_PATH env var, if set (wins — point it anywhere you like).
 *  2. On Hostinger's git deploy, the app runs from `.../<site>/nodejs`, which is
 *     REPLACED on every redeploy — so anything under it (a default ./data) is
 *     wiped each deploy. When we detect that layout we store the db in a sibling
 *     `persistent-data/` folder (`.../<site>/persistent-data/mun.db`), which sits
 *     next to `nodejs/` and survives redeploys. This is confirmed writable on
 *     the host and is what keeps accounts from disappearing.
 *  3. Otherwise (local dev), `<cwd>/data/mun.db`.
 */
function dbFilePath(): string {
  if (process.env.SQLITE_PATH) {
    const p = process.env.SQLITE_PATH;
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  const cwd = process.cwd();
  // Hostinger runs the app from a folder literally named "nodejs".
  if (path.basename(cwd) === "nodejs") {
    return path.resolve(cwd, "..", "persistent-data", "mun.db");
  }
  return path.join(cwd, "data", "mun.db");
}

/** Locate sql.js's wasm binary wherever the package is actually installed. */
function locateSqlJsFile(file: string): string {
  try {
    // Resolve the package entry, then its sibling dist/<file>. This follows the
    // real install location regardless of the process working directory.
    const pkgMain = requireFromHere.resolve("sql.js");
    const candidate = path.join(path.dirname(pkgMain), file);
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    /* fall through to cwd-based lookup */
  }
  return path.join(process.cwd(), "node_modules", "sql.js", "dist", file);
}

/**
 * MULTI-PROCESS SAFETY
 * --------------------
 * The host (LiteSpeed/Hostinger) runs several Node worker processes against the
 * same database file. A long-lived in-memory copy per process is therefore
 * unsafe: worker A inserts a user and writes the file, then worker B — still
 * holding the snapshot it loaded at boot — exports its stale copy over the top
 * and the new user vanishes. (The seeded owner appeared to "survive" only
 * because every worker re-seeds it on boot.)
 *
 * So we never keep a durable in-memory database. Every operation:
 *   1. takes a cross-process lock (an O_EXCL lockfile next to the db),
 *   2. reads the current file from disk,
 *   3. runs, and — if it wrote — saves atomically (temp file + rename),
 *   4. releases the lock.
 *
 * Reads may reuse a cached parse while the file's mtime+size are unchanged;
 * writes always re-read first, so no worker can ever clobber another's data.
 */

type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;

let SQL: SqlJsStatic | null = null;
let sqlReady: Promise<void> | null = null;
/** Serializes calls within this process (the lockfile serializes across them). */
let queue: Promise<unknown> = Promise.resolve();
/** Read-cache, valid only while the file on disk is untouched. */
let cache: { db: SqlJsDatabase; mtimeMs: number; size: number } | null = null;

const LOCK_STALE_MS = 10_000;
const LOCK_TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function initSql(): Promise<void> {
  if (SQL) return;
  if (!sqlReady) {
    sqlReady = initSqlJs({ locateFile: locateSqlJsFile })
      .then((mod) => {
        SQL = mod;
      })
      .catch((err) => {
        sqlReady = null; // don't cache a failed init
        throw err;
      });
  }
  await sqlReady;

  const dir = path.dirname(dbFilePath());
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Database directory "${dir}" is not writable. Point SQLITE_PATH at a writable, ` +
        `persistent folder on your host. (${(err as Error).message})`
    );
  }
}

/** Take the cross-process lock, clearing it if a crashed worker left it behind. */
async function acquireLock(): Promise<number> {
  const lock = `${dbFilePath()}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      return fs.openSync(lock, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        // A lockfile older than LOCK_STALE_MS means its holder died mid-write.
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lock, { force: true });
          continue;
        }
      } catch {
        continue; // the holder released it between our open and stat
      }
      if (Date.now() > deadline) throw new Error("Timed out waiting for the database lock.");
      await sleep(20);
    }
  }
}

function releaseLock(fd: number): void {
  try {
    fs.closeSync(fd);
  } finally {
    fs.rmSync(`${dbFilePath()}.lock`, { force: true });
  }
}

/** Parse the database from disk (reusing the cache when the file is unchanged). */
function loadDb(force: boolean): SqlJsDatabase {
  const file = dbFilePath();
  let st: fs.Stats | null = null;
  try {
    st = fs.statSync(file);
  } catch {
    /* no file yet — start empty */
  }
  if (!force && cache && st && cache.mtimeMs === st.mtimeMs && cache.size === st.size) {
    return cache.db;
  }
  cache?.db.close();
  cache = null;
  const db = new (SQL as SqlJsStatic).Database(st ? fs.readFileSync(file) : undefined);
  cache = st ? { db, mtimeMs: st.mtimeMs, size: st.size } : { db, mtimeMs: -1, size: -1 };
  return db;
}

/** Write the database out atomically, so a crash can never truncate the file. */
function saveDb(db: SqlJsDatabase): void {
  const file = dbFilePath();
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);
  const st = fs.statSync(file);
  cache = { db, mtimeMs: st.mtimeMs, size: st.size };
}

/** Run `fn` against the database, serialized within and across processes. */
function withDb<R>(fn: (d: SqlJsDatabase) => R, mutates: boolean): Promise<R> {
  const task = queue.then(async () => {
    await initSql();
    const fd = await acquireLock();
    try {
      // Writers must never act on a cached parse — another worker may have
      // written since we last looked.
      const db = loadDb(mutates);
      const result = fn(db);
      if (mutates) saveDb(db);
      return result;
    } finally {
      releaseLock(fd);
    }
  });
  queue = task.catch(() => {}); // one failed op must not wedge the queue
  return task as Promise<R>;
}

/**
 * Not memoized: each operation may act on a database freshly parsed from disk,
 * so a "we already created this" cache could skip the CREATE for a db object
 * that doesn't have the table yet. IF NOT EXISTS is cheap.
 */
function ensureTable(d: SqlJsDatabase, name: string): void {
  d.run(`CREATE TABLE IF NOT EXISTS "${name}" (rowid INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`);
}

/** Run a SELECT and return every row as plain objects. */
function selectAll(d: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = d.prepare(sql);
  stmt.bind(params as never);
  const out: Record<string, unknown>[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

interface Row { rowid: number; doc: Doc }

class SqliteCollection<T> implements StoreCollection<T> {
  constructor(private readonly table: string) {}

  private rows(d: SqlJsDatabase): Row[] {
    ensureTable(d, this.table);
    return selectAll(d, `SELECT rowid, data FROM "${this.table}"`).map((r) => ({
      rowid: r.rowid as number,
      doc: JSON.parse(r.data as string) as Doc,
    }));
  }

  private writeRow(d: SqlJsDatabase, rowid: number, doc: Doc): void {
    d.run(`UPDATE "${this.table}" SET data = ? WHERE rowid = ?`, [JSON.stringify(doc), rowid]);
  }

  async findOne(filter: Filter = {}): Promise<T | null> {
    return withDb((d) => {
      const hit = this.rows(d).find((r) => matchesFilter(r.doc, filter));
      return hit ? (hit.doc as unknown as T) : null;
    }, false);
  }

  find(filter: Filter = {}): Cursor<T> {
    return {
      toArray: () => withDb((d) => this.rows(d).filter((r) => matchesFilter(r.doc, filter)).map((r) => r.doc as unknown as T), false),
    };
  }

  async insertOne(doc: T): Promise<{ insertedId: number }> {
    return withDb((d) => {
      ensureTable(d, this.table);
      d.run(`INSERT INTO "${this.table}" (data) VALUES (?)`, [JSON.stringify(doc)]);
      return { insertedId: d.exec("SELECT last_insert_rowid() AS id")[0].values[0][0] as number };
    }, true);
  }

  async insertMany(docs: T[]): Promise<void> {
    return withDb((d) => {
      ensureTable(d, this.table);
      for (const doc of docs) d.run(`INSERT INTO "${this.table}" (data) VALUES (?)`, [JSON.stringify(doc)]);
    }, true);
  }

  async updateOne(filter: Filter, update: Update, options: { upsert?: boolean } = {}): Promise<WriteResult> {
    return withDb((d) => {
      const hit = this.rows(d).find((r) => matchesFilter(r.doc, filter));
      if (hit) {
        this.writeRow(d, hit.rowid, applyUpdate(hit.doc, update));
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null };
      }
      if (options.upsert) {
        d.run(`INSERT INTO "${this.table}" (data) VALUES (?)`, [JSON.stringify(buildUpsertDoc(filter, update))]);
        const id = d.exec("SELECT last_insert_rowid() AS id")[0].values[0][0] as number;
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: id };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null };
    }, true);
  }

  async updateMany(filter: Filter, update: Update): Promise<WriteResult> {
    return withDb((d) => {
      const targets = this.rows(d).filter((r) => matchesFilter(r.doc, filter));
      for (const t of targets) this.writeRow(d, t.rowid, applyUpdate(t.doc, update));
      return { matchedCount: targets.length, modifiedCount: targets.length, upsertedCount: 0, upsertedId: null };
    }, true);
  }

  async deleteOne(filter: Filter): Promise<DeleteResult> {
    return withDb((d) => {
      const hit = this.rows(d).find((r) => matchesFilter(r.doc, filter));
      if (!hit) return { deletedCount: 0 };
      d.run(`DELETE FROM "${this.table}" WHERE rowid = ?`, [hit.rowid]);
      return { deletedCount: 1 };
    }, true);
  }

  async deleteMany(filter: Filter): Promise<DeleteResult> {
    return withDb((d) => {
      const targets = this.rows(d).filter((r) => matchesFilter(r.doc, filter));
      for (const t of targets) d.run(`DELETE FROM "${this.table}" WHERE rowid = ?`, [t.rowid]);
      return { deletedCount: targets.length };
    }, true);
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return withDb((d) => {
      if (Object.keys(filter).length === 0) {
        ensureTable(d, this.table);
        const r = selectAll(d, `SELECT COUNT(*) AS n FROM "${this.table}"`);
        return r[0].n as number;
      }
      return this.rows(d).filter((r) => matchesFilter(r.doc, filter)).length;
    }, false);
  }

  async mutate(filter: Filter, mutator: (doc: T) => T | null): Promise<T | null> {
    return withDb((d) => {
      const hit = this.rows(d).find((r) => matchesFilter(r.doc, filter));
      if (!hit) return null;
      const next = mutator(hit.doc as unknown as T);
      if (next == null) return hit.doc as unknown as T; // mutator declined — leave unchanged
      this.writeRow(d, hit.rowid, next as unknown as Doc);
      return next;
    }, true);
  }

  async insertIfMissing(filter: Filter, doc: T): Promise<boolean> {
    return withDb((d) => {
      if (this.rows(d).some((r) => matchesFilter(r.doc, filter))) return false;
      d.run(`INSERT INTO "${this.table}" (data) VALUES (?)`, [JSON.stringify(doc)]);
      return true;
    }, true);
  }

  /** No-op: uniqueness is enforced at the application layer (dup checks before insert). */
  async createIndex(): Promise<void> {}
}

/** Get a collection handle (created lazily). */
export function collection<T>(name: string): StoreCollection<T> {
  return new SqliteCollection<T>(name);
}

/** For tests: drop the cached parse and reset the queue. */
export function _closeForTests(): void {
  cache?.db.close();
  cache = null;
  queue = Promise.resolve();
}
