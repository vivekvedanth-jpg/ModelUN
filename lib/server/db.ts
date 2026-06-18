/**
 * SERVER-ONLY MongoDB connection (never import this from a client component).
 *
 * Accounts and groups live in MongoDB Atlas so they persist across devices and
 * across Render's ephemeral filesystem. The owner account ("Admin1") is seeded
 * automatically on first connect.
 */

import { MongoClient, type Db, type Collection } from "mongodb";
import bcrypt from "bcryptjs";

export type Role = "owner" | "admin" | "chair" | "normal";

export interface UserProfile {
  fullName?: string;
  className?: string;
  section?: string;
  phone?: string;
}

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: Role;
  profile?: UserProfile;
  /** A group id, the literal "all" for all-access admins, or undefined. */
  groupId?: string;
  createdAt: number;
}

export interface GroupDoc {
  id: string;
  name: string;
  createdAt: number;
}

/** The permanent owner, seeded on first run. */
export const OWNER_CREDENTIALS = {
  email: "admin1@mun.app",
  password: "33cat",
} as const;

export const ALL_GROUPS = "all";

declare global {
  // Cache the client across hot-reloads / lambda invocations.
  // eslint-disable-next-line no-var
  var _munMongoClient: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _munSeeded: Promise<void> | undefined;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set — add your MongoDB Atlas connection string to the environment."
    );
  }
  if (!globalThis._munMongoClient) {
    globalThis._munMongoClient = new MongoClient(uri).connect();
  }
  return globalThis._munMongoClient;
}

async function seed(db: Db): Promise<void> {
  const users = db.collection<UserDoc>("users");
  await users.createIndex({ email: 1 }, { unique: true });
  const existing = await users.findOne({ email: OWNER_CREDENTIALS.email });
  if (!existing) {
    await users.insertOne({
      email: OWNER_CREDENTIALS.email,
      passwordHash: await bcrypt.hash(OWNER_CREDENTIALS.password, 10),
      role: "owner",
      createdAt: Date.now(),
    });
  }
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB || "mun");
  if (!globalThis._munSeeded) {
    globalThis._munSeeded = seed(db).catch((err) => {
      // Don't cache a failed seed — let the next request retry.
      globalThis._munSeeded = undefined;
      throw err;
    });
  }
  await globalThis._munSeeded;
  return db;
}

export async function usersCol(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function groupsCol(): Promise<Collection<GroupDoc>> {
  return (await getDb()).collection<GroupDoc>("groups");
}

/** Public (password-free) view of an account. */
export interface AccountDetail {
  email: string;
  role: Role;
  profile: UserProfile;
  createdAt: number;
  groupId?: string;
}

export function toDetail(u: UserDoc): AccountDetail {
  return {
    email: u.email,
    role: u.role,
    profile: u.profile ?? {},
    createdAt: u.createdAt,
    groupId: u.groupId,
  };
}
