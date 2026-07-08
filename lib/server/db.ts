/**
 * SERVER-ONLY data layer (never import this from a client component).
 *
 * Data lives in an embedded SQLite database on the host's own disk (see
 * lib/server/sqlite-store.ts) — a single file, no external database service.
 * The store exposes a MongoDB-compatible subset, so the collection helpers and
 * API routes read the same as before. The owner account ("Admin1") is seeded
 * automatically on first access.
 *
 * The SQLite file location defaults to `<cwd>/data/mun.db` and can be overridden
 * with the SQLITE_PATH environment variable (point this at a persistent disk
 * path on your host).
 */

import bcrypt from "bcryptjs";
import { collection, type StoreCollection } from "./sqlite-store";

export type Role = "owner" | "admin" | "chair" | "normal" | "guest";

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
  /** Guest accounts only: epoch ms after which the account is auto-deleted. */
  expiresAt?: number;
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
  // Cache the one-time owner seed across hot-reloads.
  // eslint-disable-next-line no-var
  var _munSeeded: Promise<void> | undefined;
}

async function seed(): Promise<void> {
  const users = collection<UserDoc>("users");
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

/** Ensure the owner account exists before serving any request. */
async function ready(): Promise<void> {
  if (!globalThis._munSeeded) {
    globalThis._munSeeded = seed().catch((err) => {
      globalThis._munSeeded = undefined; // don't cache a failed seed
      throw err;
    });
  }
  await globalThis._munSeeded;
}

export async function usersCol(): Promise<StoreCollection<UserDoc>> {
  await ready();
  return collection<UserDoc>("users");
}

export async function groupsCol(): Promise<StoreCollection<GroupDoc>> {
  await ready();
  return collection<GroupDoc>("groups");
}

/** Public (password-free) view of an account. */
export interface AccountDetail {
  email: string;
  role: Role;
  profile: UserProfile;
  createdAt: number;
  groupId?: string;
  expiresAt?: number;
}

export function toDetail(u: UserDoc): AccountDetail {
  return {
    email: u.email,
    role: u.role,
    profile: u.profile ?? {},
    createdAt: u.createdAt,
    groupId: u.groupId,
    expiresAt: u.expiresAt,
  };
}

/**
 * Canonical award placements. Stored verbatim on experiences; admins can give
 * them custom display names via the "award_names" settings key, but the
 * canonical strings are what's persisted and scored.
 */
export const PLACEMENTS = [
  "Best Delegate",
  "Outstanding Delegate",
  "Honorable Mention",
  "Special Mention",
  "Verbal Mention",
  "Participant",
  "Other / None",
] as const;

/** Placements that count as "awards" (podium finishes). */
export const AWARD_PLACEMENTS = [
  "Best Delegate",
  "Outstanding Delegate",
  "Honorable Mention",
] as const;

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

export async function experiencesCol(): Promise<StoreCollection<ExperienceDoc>> {
  await ready();
  return collection<ExperienceDoc>("experiences");
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

export async function questionsCol(): Promise<StoreCollection<QuestionDoc>> {
  await ready();
  return collection<QuestionDoc>("questions");
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

/** One person's emoji reaction to a chat message. */
export interface MessageReaction {
  emoji: string;
  email: string; // lowercased reactor email
}

/** A simple committee chat message. toEmail undefined = visible to the whole committee. */
export interface CommitteeMessage {
  id: string;
  authorEmail: string;
  authorName: string;
  toEmail?: string;
  text: string;
  createdAt: number;
  /** True for chair/admin announcements (highlighted in the chat). */
  announcement?: boolean;
  reactions?: MessageReaction[];
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

export async function committeesCol(): Promise<StoreCollection<CommitteeDoc>> {
  await ready();
  return collection<CommitteeDoc>("committees");
}

/* ────────────────────────── Committee files collection ───────────────────── */

/**
 * A document the chair/admins share with a committee (RoP, format guides…).
 * Stored inline as a base64 data URL, like experience scorecards. Kept in its
 * own collection so big files never push the committee doc toward Mongo's
 * 16 MB document cap.
 */
export interface CommitteeFileDoc {
  id: string;
  committeeId: string;
  name: string;
  mime: string;
  /** Decoded size in bytes (approximate, derived from the data URL). */
  size: number;
  dataUrl: string;
  uploadedBy: string; // lowercased uploader email
  uploaderName: string;
  createdAt: number;
}

export async function committeeFilesCol(): Promise<StoreCollection<CommitteeFileDoc>> {
  await ready();
  return collection<CommitteeFileDoc>("committee_files");
}

/* ─────────────────────────── Contact collection ─────────────────────────── */

export interface MessageDoc {
  id: string; name: string; email: string; message: string; createdAt: number;
}

export async function messagesCol(): Promise<StoreCollection<MessageDoc>> {
  await ready();
  return collection<MessageDoc>("messages");
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

export async function resourcesCol(): Promise<StoreCollection<ResourceDoc>> {
  await ready();
  return collection<ResourceDoc>("resources");
}

export async function videosCol(): Promise<StoreCollection<VideoDoc>> {
  await ready();
  return collection<VideoDoc>("videos");
}

/* ──────────────────────────── Documents collection ──────────────────────── */

export interface ResolutionDocDb {
  id: string; owner: string; title: string; html: string;
  createdAt: number; updatedAt: number;
}

export async function documentsCol(): Promise<StoreCollection<ResolutionDocDb>> {
  await ready();
  return collection<ResolutionDocDb>("documents");
}

/* ──────────────────────────── Settings collection ───────────────────────── */

export interface SettingDoc { key: string; value: unknown; }

export async function settingsCol(): Promise<StoreCollection<SettingDoc>> {
  await ready();
  return collection<SettingDoc>("settings");
}
