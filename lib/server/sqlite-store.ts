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

let db: SqlJsDatabase | null = null;
let ready: Promise<void> | null = null;
/** Serializes every store call so reads/writes never interleave (single writer at a time). */
let queue: Promise<unknown> = Promise.resolve();
let dirty = false;

async function init(): Promise<void> {
  if (db) return;
  const SQL = await initSqlJs({ locateFile: locateSqlJsFile });

  const file = dbFilePath();
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    // Verify the directory is actually writable *now*, so we fail at startup
    // with a clear message rather than on the first user write.
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Database directory "${dir}" is not writable. Point SQLITE_PATH at a writable, ` +
        `persistent folder on your host. (${(err as Error).message})`
    );
  }

  const bytes = fs.existsSync(file) ? fs.readFileSync(file) : undefined;
  db = new SQL.Database(bytes);
}

/**
 * Persist the in-memory database to disk atomically: write to a temp file and
 * rename over the target, so a crash mid-write can never leave a truncated,
 * unreadable .db (which would brick every subsequent boot).
 */
function flush(): void {
  if (!db || !dirty) return;
  const file = dbFilePath();
  const tmp = `${file}.tmp-${process.pid}`;
  const data = db.export();
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, file);
  dirty = false;
}

/** Run `fn` against the live db, serialized after all prior calls; flushes to disk if it wrote. */
function withDb<R>(fn: (d: SqlJsDatabase) => R, mutates: boolean): Promise<R> {
  const task = queue.then(async () => {
    if (!ready) ready = init();
    await ready;
    const result = fn(db as SqlJsDatabase);
    if (mutates) { dirty = true; flush(); }
    return result;
  });
  queue = task.catch(() => {}); // one failed op must not wedge the queue
  return task as Promise<R>;
}

const knownTables = new Set<string>();

function ensureTable(d: SqlJsDatabase, name: string): void {
  if (knownTables.has(name)) return;
  d.run(`CREATE TABLE IF NOT EXISTS "${name}" (rowid INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`);
  knownTables.add(name);
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

  /** No-op: uniqueness is enforced at the application layer (dup checks before insert). */
  async createIndex(): Promise<void> {}
}

/** Get a collection handle (created lazily). */
export function collection<T>(name: string): StoreCollection<T> {
  return new SqliteCollection<T>(name);
}

/** For tests: close and reset the connection. */
export function _closeForTests(): void {
  if (db) { flush(); db.close(); db = null; }
  ready = null;
  queue = Promise.resolve();
  knownTables.clear();
}
