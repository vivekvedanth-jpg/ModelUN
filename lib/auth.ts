/**
 * Lightweight, mocked authentication + account-management layer for Phase 1.
 *
 * Accounts are persisted in the browser's localStorage and are identified by
 * EMAIL + password. This is intentionally simple so the front-end can be built
 * without a real backend.
 *
 * ACCESS MODEL (enforced here for the prototype, must move to a server later):
 *   - There is NO public sign-up. Accounts can only be created by an
 *     authenticated user with administrative privileges.
 *   - The Owner account is seeded automatically the first time the app runs
 *     (the localStorage equivalent of a seed migration).
 *   - Only the Owner can promote users to Admin, or demote / delete Admins.
 *     Regular admins can only create and manage "normal" (delegate) accounts.
 *
 * ⚠️  SECURITY NOTE: passwords are stored in plaintext in localStorage and all
 * permission checks run in the browser. This is fine for local prototyping
 * ONLY. Before production this must be replaced with a real backend (hashed
 * passwords, httpOnly session cookies, SERVER-SIDE role checks, and a real seed
 * migration that creates the Owner). See the README for the migration path.
 */

export type Role = "owner" | "admin" | "chair" | "normal";

/** The shape we expose to the rest of the app (never includes the password). */
export interface User {
  email: string;
  role: Role;
}

/** Optional personal details a delegate can fill in from Settings. */
export interface Profile {
  fullName?: string;
  className?: string;
  section?: string;
  phone?: string;
}

/** A fuller account view for admin screens (no password). */
export interface AccountDetail {
  email: string;
  role: Role;
  profile: Profile;
  createdAt: number;
  /** Group membership (a group id, ALL_GROUPS for all-access admins, or none). */
  groupId?: string;
}

/** The shape we persist in localStorage. */
interface StoredUser {
  email: string;
  password: string;
  role: Role;
  createdAt: number;
  profile?: Profile;
  /** Group membership (a group id, ALL_GROUPS for all-access admins, or none). */
  groupId?: string;
}

/*
 * Storage keys are versioned. Bumping the suffix transparently discards any
 * older-schema data (e.g. the previous username-based accounts), which also
 * clears stale sessions left over from earlier builds.
 */
const USERS_KEY = "mun_users_v2";
const SESSION_KEY = "mun_session_v2";

/**
 * The permanent Owner account. Seeded automatically on first run. The password
 * is only a default for the prototype — change it after first sign-in once a
 * real backend exists.
 */
export const OWNER_CREDENTIALS = {
  email: "admin1@mun.app",
  password: "33cat",
} as const;

/**
 * Sentinel group id meaning "this admin can access every group". Stored as an
 * account's groupId. Real group ids never collide with this literal.
 */
export const ALL_GROUPS = "all";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** A friendly display name derived from an email (the part before the "@"). */
export function displayName(user: User | null | undefined): string {
  if (!user) return "";
  return user.email.split("@")[0] || user.email;
}

/** True for any account that can reach admin areas (owner counts as admin). */
export function isAdmin(role: Role | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** True only for the permanent Owner account (robust against a stale role). */
export function isOwner(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === "owner" ||
    user.email.toLowerCase() === OWNER_CREDENTIALS.email.toLowerCase()
  );
}

/** True for chair accounts (committee scorers). */
export function isChair(role: Role | undefined): boolean {
  return role === "chair";
}

/**
 * True for anyone allowed into the committee-scoring area: chairs run their own
 * committees, and the Owner can oversee every committee.
 */
export function canScoreCommittees(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === "chair" || isOwner(user);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function rawReadUsers(): StoredUser[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Ensures the permanent Owner account exists. This is the prototype's stand-in
 * for a seed migration — it runs lazily on the first read so the Owner is
 * always present and can never be removed.
 */
function ensureSeeded(): StoredUser[] {
  const users = rawReadUsers();
  const hasOwner = users.some(
    (u) =>
      u.role === "owner" ||
      u.email.toLowerCase() === OWNER_CREDENTIALS.email.toLowerCase()
  );
  if (hasOwner) return users;

  const owner: StoredUser = {
    email: OWNER_CREDENTIALS.email,
    password: OWNER_CREDENTIALS.password,
    role: "owner",
    createdAt: Date.now(),
  };
  const seeded = [owner, ...users];
  writeUsers(seeded);
  return seeded;
}

function readUsers(): StoredUser[] {
  return ensureSeeded();
}

function findUser(users: StoredUser[], email: string): StoredUser | undefined {
  return users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
}

/**
 * Returns every account (owner, admins and delegates). Admins are allowed to
 * view all accounts, so this is unfiltered — gate the calling UI instead.
 */
export function getAllUsers(): User[] {
  return readUsers()
    .map(({ email, role }) => ({ email, role }))
    .sort((a, b) => {
      const order: Record<Role, number> = { owner: 0, admin: 1, chair: 2, normal: 3 };
      return order[a.role] - order[b.role] || a.email.localeCompare(b.email);
    });
}

/** Like getAllUsers but includes each account's profile + join date (admin view). */
export function getAccounts(): AccountDetail[] {
  return readUsers()
    .map((u) => ({
      email: u.email,
      role: u.role,
      profile: u.profile ?? {},
      createdAt: u.createdAt,
      groupId: u.groupId,
    }))
    .sort((a, b) => {
      const order: Record<Role, number> = { owner: 0, admin: 1, chair: 2, normal: 3 };
      return order[a.role] - order[b.role] || a.email.localeCompare(b.email);
    });
}

/* ----------------------------------- Groups ---------------------------------- */

/** The group id stored on the actor's account (or undefined). */
export function getActorGroupId(actor: User | null): string | undefined {
  if (!actor) return undefined;
  return findUser(readUsers(), actor.email)?.groupId;
}

/** True if the actor can see every group (the Owner, or an all-access admin). */
export function canViewAllGroups(actor: User | null): boolean {
  if (!actor) return false;
  if (isOwner(actor)) return true;
  return findUser(readUsers(), actor.email)?.groupId === ALL_GROUPS;
}

/**
 * The accounts the actor is allowed to see. The Owner and all-access admins see
 * everyone; a group-scoped admin sees only their own group (plus themselves).
 */
export function getVisibleAccounts(actor: User | null): AccountDetail[] {
  const all = getAccounts();
  if (!actor) return [];
  if (canViewAllGroups(actor)) return all;
  const myGroup = getActorGroupId(actor);
  return all.filter(
    (a) =>
      a.email.toLowerCase() === actor.email.toLowerCase() ||
      (!!myGroup && a.groupId === myGroup)
  );
}

/** Every account assigned to a specific group (for the Owner's group view). */
export function getAccountsInGroup(groupId: string): AccountDetail[] {
  return getAccounts().filter((a) => a.groupId === groupId);
}

/** Admins who can access every group. */
export function getAllAccessAdmins(): AccountDetail[] {
  return getAccounts().filter(
    (a) => a.role === "admin" && a.groupId === ALL_GROUPS
  );
}

/**
 * Owner-only: assign an account to a group (pass ALL_GROUPS for an all-access
 * admin, or undefined to remove it from any group).
 */
export function setGroup(
  actor: User | null,
  targetEmail: string,
  groupId: string | undefined
): void {
  if (!isOwner(actor)) {
    throw new Error("Only the Owner can change a user's group.");
  }
  const users = readUsers();
  const target = findUser(users, targetEmail);
  if (!target) throw new Error("That account no longer exists.");
  if (target.role === "owner") {
    throw new Error("The Owner isn't part of a group.");
  }
  target.groupId = groupId && groupId.trim() ? groupId.trim() : undefined;
  writeUsers(users);
}

/** Clears a group from every account (used when a group is deleted). */
export function clearGroup(groupId: string): void {
  const users = readUsers();
  let changed = false;
  for (const u of users) {
    if (u.groupId === groupId) {
      u.groupId = undefined;
      changed = true;
    }
  }
  if (changed) writeUsers(users);
}

/** Reads a single account's profile (empty object if none/unknown). */
export function getProfile(email: string): Profile {
  return findUser(readUsers(), email)?.profile ?? {};
}

/** Reads a single account's join date, or undefined if unknown. */
export function getJoinDate(email: string): number | undefined {
  return findUser(readUsers(), email)?.createdAt;
}

/** Updates the signed-in user's own profile details. */
export function updateProfile(actor: User | null, profile: Profile): Profile {
  if (!actor) throw new Error("You must be signed in.");
  const users = readUsers();
  const me = findUser(users, actor.email);
  if (!me) throw new Error("Your account no longer exists.");

  const clean: Profile = {
    fullName: profile.fullName?.trim() || undefined,
    className: profile.className?.trim() || undefined,
    section: profile.section?.trim() || undefined,
    phone: profile.phone?.trim() || undefined,
  };
  me.profile = clean;
  writeUsers(users);
  return clean;
}

/** Reads the currently signed-in user from the persisted session (raw). */
export function getSession(): User | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setSession(user: User | null): void {
  if (!isBrowser()) return;
  if (user) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Reads the session AND re-validates it against the account store, so a role
 * that changed (or an account that was deleted) since sign-in is reflected
 * immediately. This prevents stale sessions from earlier builds granting the
 * wrong permissions.
 */
export function getValidatedSession(): User | null {
  const session = getSession();
  if (!session) return null;

  const match = findUser(readUsers(), session.email);
  if (!match) {
    setSession(null);
    return null;
  }

  const fresh: User = { email: match.email, role: match.role };
  setSession(fresh);
  return fresh;
}

/**
 * Authenticates a user against the account store. Throws an Error on failure.
 * There is deliberately no sign-up counterpart — accounts are created by admins.
 */
export function signIn(email: string, password: string): User {
  const match = findUser(readUsers(), email);
  if (!match || match.password !== password) {
    throw new Error("Invalid email or password.");
  }

  const sessionUser: User = { email: match.email, role: match.role };
  setSession(sessionUser);
  return sessionUser;
}

/** Clears the current session. */
export function signOut(): void {
  setSession(null);
}

/**
 * Creates a new account on behalf of an authenticated admin/owner.
 *
 * Permission rules:
 *   - The actor must be an admin or the owner.
 *   - Only the owner may create accounts with the "admin" role.
 *   - Nobody can create another "owner" — there is exactly one.
 */
export function createAccount(
  actor: User | null,
  email: string,
  password: string,
  role: "admin" | "chair" | "normal",
  groupId?: string
): User {
  if (!actor || !isAdmin(actor.role)) {
    throw new Error("You don't have permission to create accounts.");
  }
  if ((role === "admin" || role === "chair") && !isOwner(actor)) {
    throw new Error("Only the Owner can create admin or chair accounts.");
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (password.length < 4) {
    throw new Error("Password must be at least 4 characters long.");
  }

  const users = readUsers();
  if (findUser(users, cleanEmail)) {
    throw new Error("An account with that email already exists.");
  }

  // Work out which group the new account belongs to.
  const actorRecord = findUser(users, actor.email);
  const actorCanAssign =
    isOwner(actor) || actorRecord?.groupId === ALL_GROUPS;
  let finalGroup: string | undefined;
  if (role === "chair") {
    finalGroup = undefined; // chairs aren't part of groups
  } else if (actorCanAssign) {
    const picked = groupId && groupId.trim() ? groupId.trim() : undefined;
    // Admins default to all-access unless the Owner picks a specific group.
    finalGroup = role === "admin" ? picked ?? ALL_GROUPS : picked;
  } else {
    // A group-scoped admin: new delegates join the admin's own group.
    finalGroup = actorRecord?.groupId;
  }

  const newUser: StoredUser = {
    email: cleanEmail,
    password,
    role,
    createdAt: Date.now(),
    groupId: finalGroup,
  };
  writeUsers([...users, newUser]);
  return { email: cleanEmail, role };
}

/**
 * Promotes or demotes an account between "admin" and "normal".
 * Only the Owner may do this, and the Owner account itself cannot be changed.
 */
export function setRole(
  actor: User | null,
  targetEmail: string,
  role: "admin" | "chair" | "normal"
): void {
  if (!isOwner(actor)) {
    throw new Error("Only the Owner can change a user's role.");
  }

  const users = readUsers();
  const target = findUser(users, targetEmail);
  if (!target) {
    throw new Error("That account no longer exists.");
  }
  if (target.role === "owner") {
    throw new Error("The Owner account's role cannot be changed.");
  }

  target.role = role;
  writeUsers(users);
}

/**
 * Deletes an account.
 *
 * Permission rules:
 *   - The actor must be an admin or the owner.
 *   - The Owner account can never be deleted.
 *   - Only the Owner may delete admin accounts; regular admins may only delete
 *     "normal" delegate accounts.
 *   - You cannot delete your own account.
 */
export function deleteAccount(actor: User | null, targetEmail: string): void {
  if (!actor || !isAdmin(actor.role)) {
    throw new Error("You don't have permission to delete accounts.");
  }

  const users = readUsers();
  const target = findUser(users, targetEmail);
  if (!target) {
    throw new Error("That account no longer exists.");
  }
  if (target.role === "owner") {
    throw new Error("The Owner account cannot be deleted.");
  }
  if (target.email.toLowerCase() === actor.email.toLowerCase()) {
    throw new Error("You cannot delete your own account.");
  }
  if ((target.role === "admin" || target.role === "chair") && !isOwner(actor)) {
    throw new Error("Only the Owner can delete admin or chair accounts.");
  }

  writeUsers(users.filter((u) => u.email !== target.email));
}

/**
 * Changes the signed-in user's own password after verifying the current one.
 */
export function changePassword(
  actor: User | null,
  currentPassword: string,
  newPassword: string
): void {
  if (!actor) throw new Error("You must be signed in.");

  const users = readUsers();
  const me = findUser(users, actor.email);
  if (!me) throw new Error("Your account no longer exists.");
  if (me.password !== currentPassword) {
    throw new Error("Your current password is incorrect.");
  }
  if (newPassword.length < 4) {
    throw new Error("New password must be at least 4 characters long.");
  }
  if (newPassword === currentPassword) {
    throw new Error("Please choose a password different from the current one.");
  }

  me.password = newPassword;
  writeUsers(users);
}

/**
 * Changes the signed-in user's own email after verifying their password.
 * Returns the updated User and refreshes the persisted session. Callers should
 * also migrate any records keyed by the old email (experiences, Q&A, …).
 */
export function changeEmail(
  actor: User | null,
  newEmail: string,
  currentPassword: string
): { user: User; oldEmail: string } {
  if (!actor) throw new Error("You must be signed in.");

  const cleanEmail = newEmail.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  const users = readUsers();
  const me = findUser(users, actor.email);
  if (!me) throw new Error("Your account no longer exists.");
  if (me.password !== currentPassword) {
    throw new Error("Your password is incorrect.");
  }
  if (cleanEmail === me.email.toLowerCase()) {
    throw new Error("That's already your email address.");
  }
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error("Another account already uses that email.");
  }

  const oldEmail = me.email;
  me.email = cleanEmail;
  writeUsers(users);

  const updated: User = { email: cleanEmail, role: me.role };
  setSession(updated);
  return { user: updated, oldEmail };
}
