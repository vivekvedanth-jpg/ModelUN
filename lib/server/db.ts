/**
 * SERVER-ONLY data layer (never import this from a client component).
 *
 * Data lives in an embedded SQLite database on the host's own disk (see
 * lib/server/sqlite-store.ts) — a single file, no external database service.
 * The owner account is seeded automatically on first access; every other
 * account (delegates, chairs, admins) is created through the app and stored in
 * the same SQLite file.
 *
 * The SQLite file location defaults to `<cwd>/data/mun.db` and can be overridden
 * with the SQLITE_PATH environment variable (point this at a persistent disk
 * path on your host so accounts survive redeploys).
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
  /** Epoch ms when this user accepted the data-usage terms (unset = not yet). */
  acceptedTermsAt?: number;
  /** Admins only: the Owner has granted this admin access to the analytics dashboard. */
  canViewAnalytics?: boolean;
  /** The Owner/an admin has granted this account permission to write blog posts. */
  canWriteBlog?: boolean;
  /**
   * Password-reset state — server-only, never sent to the client (not part of
   * AccountDetail/toDetail). The token itself is never stored, only its SHA-256
   * hash, so a database leak alone can't be used to reset an account.
   */
  resetTokenHash?: string;
  resetTokenExpiresAt?: number;
}

export interface GroupDoc {
  id: string;
  name: string;
  createdAt: number;
}

/** The permanent owner, seeded on first run. */
export const OWNER_CREDENTIALS = {
  email: "vivek@letsmun.com",
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
  // Atomic: several worker processes boot at once, and a findOne-then-insertOne
  // would let more than one of them insert a second owner.
  await users.insertIfMissing(
    { email: OWNER_CREDENTIALS.email },
    {
      email: OWNER_CREDENTIALS.email,
      passwordHash: await bcrypt.hash(OWNER_CREDENTIALS.password, 10),
      role: "owner",
      createdAt: Date.now(),
    }
  );
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
  acceptedTermsAt?: number;
  canViewAnalytics?: boolean;
  canWriteBlog?: boolean;
}

export function toDetail(u: UserDoc): AccountDetail {
  return {
    email: u.email,
    role: u.role,
    profile: u.profile ?? {},
    createdAt: u.createdAt,
    groupId: u.groupId,
    expiresAt: u.expiresAt,
    acceptedTermsAt: u.acceptedTermsAt,
    canViewAnalytics: u.canViewAnalytics,
    canWriteBlog: u.canWriteBlog,
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
   * the store's dotted-path queries treat "." as a path separator, which would
   * corrupt emails used as object keys.
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
 * own collection so committee reads/writes don't have to carry large file
 * payloads around.
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
  /** Admin-defined grouping, e.g. category "Research" → subcategory "Position Papers". */
  category?: string;
  subcategory?: string;
}

export interface VideoDoc {
  id: string; title: string; category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string; url?: string; seeded?: boolean;
  /** Position in the study plan (ascending). Unset videos sort to the end. */
  order?: number;
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

/* ────────────────────────────── Blog collection ─────────────────────────── */

export interface BlogPostDoc {
  id: string;
  /** URL-safe unique slug (derived from the title). */
  slug: string;
  title: string;
  /** Short summary used on cards and as the page meta description. */
  excerpt: string;
  /** Optional cover image as a base64 data URL. */
  coverImage?: string;
  /** Article body as sanitised HTML (same shape as the document editor). */
  html: string;
  /** Optional single category/tag label. */
  tag?: string;
  authorEmail: string;
  authorName: string;
  /** Estimated reading time in minutes. */
  readingMinutes: number;
  /** Drafts (false) are visible only to their author + admins. */
  published: boolean;
  createdAt: number;
  updatedAt: number;
  /** First time it was published (unset while still a draft). */
  publishedAt?: number;
  /**
   * Who may comment on this post (author/admin choice):
   *  - "off"       — comments disabled
   *  - "signed-in" — only logged-in accounts (default)
   *  - "anyone"    — anyone, including logged-out visitors
   */
  commentPolicy?: "off" | "signed-in" | "anyone";
}

export type CommentPolicy = NonNullable<BlogPostDoc["commentPolicy"]>;

export async function blogPostsCol(): Promise<StoreCollection<BlogPostDoc>> {
  await ready();
  return collection<BlogPostDoc>("blog_posts");
}

export interface BlogCommentDoc {
  id: string;
  postId: string;
  authorName: string;
  /** Lowercased account email when the commenter was signed in. */
  authorEmail?: string;
  /** Plain text (never HTML) — rendered as text so it can't inject markup. */
  body: string;
  createdAt: number;
}

export async function blogCommentsCol(): Promise<StoreCollection<BlogCommentDoc>> {
  await ready();
  return collection<BlogCommentDoc>("blog_comments");
}

/* ──────────────────────────── Settings collection ───────────────────────── */

export interface SettingDoc { key: string; value: unknown; }

export async function settingsCol(): Promise<StoreCollection<SettingDoc>> {
  await ready();
  return collection<SettingDoc>("settings");
}
