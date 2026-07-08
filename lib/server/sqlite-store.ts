/**
 * SERVER-ONLY embedded document store backed by SQLite (better-sqlite3).
 *
 * It exposes a tiny MongoDB-compatible subset (findOne/find/insertOne/updateOne/
 * updateMany/deleteOne/deleteMany/countDocuments/createIndex) so the existing API
 * routes keep working almost unchanged after moving off MongoDB Atlas. Each
 * collection is a SQLite table `(rowid, data JSON)`; documents are plain JSON.
 *
 * better-sqlite3 is synchronous, and Node runs our request handlers on a single
 * thread, so every store operation is naturally atomic — no races on the
 * committee chat/votes that MongoDB previously guarded with $-operators.
 *
 * The query/update helpers below are pure (no I/O) and unit-tested separately.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/* ─────────────────────────── Pure query engine ──────────────────────────── */

type Doc = Record<string, unknown>;
type Filter = Record<string, unknown>;
type Update = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof RegExp);
}

/** Mongo-style path resolution: descending into an array applies the field to each element. */
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

/** Apply Mongo-style update operators to a clone of `doc`, returning the new doc. */
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

let db: Database.Database | null = null;

function handle(): Database.Database {
  if (db) return db;
  const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "mun.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL"); // better concurrency for our read-heavy load
  db.pragma("foreign_keys = ON");
  return db;
}

const knownTables = new Set<string>();

function ensureTable(name: string): void {
  if (knownTables.has(name)) return;
  handle().exec(`CREATE TABLE IF NOT EXISTS "${name}" (rowid INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`);
  knownTables.add(name);
}

class SqliteCollection<T> implements StoreCollection<T> {
  constructor(private readonly table: string) {
    ensureTable(table);
  }

  /** Load & parse every row (SQLite is fast at our scale; no open cursor kept). */
  private rows(): { rowid: number; doc: Doc }[] {
    const stmt = handle().prepare(`SELECT rowid, data FROM "${this.table}"`);
    return (stmt.all() as { rowid: number; data: string }[]).map((r) => ({ rowid: r.rowid, doc: JSON.parse(r.data) as Doc }));
  }

  private write(rowid: number, doc: Doc): void {
    handle().prepare(`UPDATE "${this.table}" SET data = ? WHERE rowid = ?`).run(JSON.stringify(doc), rowid);
  }

  async findOne(filter: Filter = {}): Promise<T | null> {
    const hit = this.rows().find((r) => matchesFilter(r.doc, filter));
    return hit ? (hit.doc as unknown as T) : null;
  }

  find(filter: Filter = {}): Cursor<T> {
    return {
      toArray: async () => this.rows().filter((r) => matchesFilter(r.doc, filter)).map((r) => r.doc as unknown as T),
    };
  }

  async insertOne(doc: T): Promise<{ insertedId: number }> {
    const info = handle().prepare(`INSERT INTO "${this.table}" (data) VALUES (?)`).run(JSON.stringify(doc));
    return { insertedId: Number(info.lastInsertRowid) };
  }

  async insertMany(docs: T[]): Promise<void> {
    const stmt = handle().prepare(`INSERT INTO "${this.table}" (data) VALUES (?)`);
    const tx = handle().transaction((items: T[]) => { items.forEach((d) => stmt.run(JSON.stringify(d))); });
    tx(docs);
  }

  async updateOne(filter: Filter, update: Update, options: { upsert?: boolean } = {}): Promise<WriteResult> {
    const hit = this.rows().find((r) => matchesFilter(r.doc, filter));
    if (hit) {
      this.write(hit.rowid, applyUpdate(hit.doc, update));
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null };
    }
    if (options.upsert) {
      const info = handle().prepare(`INSERT INTO "${this.table}" (data) VALUES (?)`).run(JSON.stringify(buildUpsertDoc(filter, update)));
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: Number(info.lastInsertRowid) };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null };
  }

  async updateMany(filter: Filter, update: Update): Promise<WriteResult> {
    const targets = this.rows().filter((r) => matchesFilter(r.doc, filter));
    const upd = handle().prepare(`UPDATE "${this.table}" SET data = ? WHERE rowid = ?`);
    handle().transaction(() => { targets.forEach((t) => upd.run(JSON.stringify(applyUpdate(t.doc, update)), t.rowid)); })();
    return { matchedCount: targets.length, modifiedCount: targets.length, upsertedCount: 0, upsertedId: null };
  }

  async deleteOne(filter: Filter): Promise<DeleteResult> {
    const hit = this.rows().find((r) => matchesFilter(r.doc, filter));
    if (!hit) return { deletedCount: 0 };
    handle().prepare(`DELETE FROM "${this.table}" WHERE rowid = ?`).run(hit.rowid);
    return { deletedCount: 1 };
  }

  async deleteMany(filter: Filter): Promise<DeleteResult> {
    const targets = this.rows().filter((r) => matchesFilter(r.doc, filter));
    const del = handle().prepare(`DELETE FROM "${this.table}" WHERE rowid = ?`);
    handle().transaction(() => { targets.forEach((t) => del.run(t.rowid)); })();
    return { deletedCount: targets.length };
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    if (Object.keys(filter).length === 0) {
      const r = handle().prepare(`SELECT COUNT(*) AS n FROM "${this.table}"`).get() as { n: number };
      return r.n;
    }
    return this.rows().filter((r) => matchesFilter(r.doc, filter)).length;
  }

  async mutate(filter: Filter, mutator: (doc: T) => T | null): Promise<T | null> {
    const hit = this.rows().find((r) => matchesFilter(r.doc, filter));
    if (!hit) return null;
    const next = mutator(hit.doc as unknown as T);
    if (next == null) return hit.doc as unknown as T; // mutator declined — leave unchanged
    this.write(hit.rowid, next as unknown as Doc);
    return next;
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
  if (db) { db.close(); db = null; knownTables.clear(); }
}
