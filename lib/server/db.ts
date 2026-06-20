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

/* ────────────────────────── Experience collection ────────────────────────── */

export interface ExperienceDoc {
  id: string;
  owner: string;
  conference: string;
  date: string;
  committee: string;
  portfolio: string;
  placement: string;
  notes?: string;
  scorecardName?: string;
  scorecardDataUrl?: string;
  createdAt: number;
}

export async function experiencesCol(): Promise<Collection<ExperienceDoc>> {
  return (await getDb()).collection<ExperienceDoc>("experiences");
}

/* ──────────────────────────── Q&A collection ─────────────────────────────── */

export interface QuestionDoc {
  id: string;
  author: string;
  text: string;
  visibility: "public" | "private";
  createdAt: number;
  answer?: string;
  answeredBy?: string;
  answeredAt?: number;
}

export async function questionsCol(): Promise<Collection<QuestionDoc>> {
  return (await getDb()).collection<QuestionDoc>("questions");
}

/* ─────────────────────────── Committee collection ───────────────────────── */

export interface ScoreColumn { id: string; label: string; }
export interface CommitteeDelegate {
  id: string; name: string; portfolio?: string; scores: Record<string, number>;
  /** Linked user account (lowercased email). Present when the delegate has a login. */
  email?: string;
}
export interface SpeakerEntry { id: string; name: string; done: boolean; }

/** A yes/no vote the chair runs (mod-caucus topic, resolution, etc.). */
export type VoteThreshold = "simple" | "twothirds";
export interface VoteRecord {
  id: string;
  title: string;
  threshold: VoteThreshold;
  startedAt: number;
  durationSec: number;
  /** True once the chair closes it early (it also auto-closes when time runs out). */
  closed: boolean;
  /**
   * One entry per voter. Stored as an array (not an email-keyed object) because
   * MongoDB treats dots in field names as path separators, which corrupts emails.
   */
  ballots: VoteBallot[];
}
export interface VoteBallot {
  email: string; // lowercased voter email
  choice: "yes" | "no";
}

/** A simple committee chat message. toEmail undefined = visible to the whole committee. */
export interface CommitteeMessage {
  id: string;
  authorEmail: string;
  authorName: string;
  toEmail?: string;
  text: string;
  createdAt: number;
}

/** "What's happening now" banner: unmod caucus, lunch break, etc. */
export interface SessionStatus {
  label: string;
  startedAt: number;
  /** Optional countdown length in seconds. */
  durationSec?: number;
}

export interface CommitteeDoc {
  id: string;
  chair: string;
  name: string;
  conference?: string;
  columns: ScoreColumn[];
  delegates: CommitteeDelegate[];
  speakers: SpeakerEntry[];
  currentSpeakerId?: string;
  published: boolean;
  vote?: VoteRecord;
  messages?: CommitteeMessage[];
  session?: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export async function committeesCol(): Promise<Collection<CommitteeDoc>> {
  return (await getDb()).collection<CommitteeDoc>("committees");
}

/* ─────────────────────────── Contact collection ─────────────────────────── */

export interface MessageDoc {
  id: string; name: string; email: string; message: string; createdAt: number;
}

export async function messagesCol(): Promise<Collection<MessageDoc>> {
  return (await getDb()).collection<MessageDoc>("messages");
}

/* ──────────────────────────── Content collections ───────────────────────── */

export interface ResourceDoc {
  id: string; title: string; type: string; format: string;
  desc: string; url?: string; seeded?: boolean;
}

export interface VideoDoc {
  id: string; title: string; category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string; url?: string; seeded?: boolean;
}

export async function resourcesCol(): Promise<Collection<ResourceDoc>> {
  return (await getDb()).collection<ResourceDoc>("resources");
}

export async function videosCol(): Promise<Collection<VideoDoc>> {
  return (await getDb()).collection<VideoDoc>("videos");
}

/* ──────────────────────────── Documents collection ──────────────────────── */

export interface ResolutionDocDb {
  id: string; owner: string; title: string; html: string;
  createdAt: number; updatedAt: number;
}

export async function documentsCol(): Promise<Collection<ResolutionDocDb>> {
  return (await getDb()).collection<ResolutionDocDb>("documents");
}

/* ──────────────────────────── Settings collection ───────────────────────── */

export interface SettingDoc { key: string; value: unknown; }

export async function settingsCol(): Promise<Collection<SettingDoc>> {
  return (await getDb()).collection<SettingDoc>("settings");
}
