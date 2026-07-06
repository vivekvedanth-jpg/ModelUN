/**
 * Client-side auth layer.
 *
 * Accounts now live in a real backend (MongoDB, via the /api routes), so the
 * data functions here are async fetch wrappers and the session is an httpOnly
 * cookie managed by the server. The small pure helpers (isAdmin, displayName,
 * …) stay synchronous because they only read the already-loaded User object.
 */

export type Role = "owner" | "admin" | "chair" | "normal" | "guest";

/** The session shape exposed to the app (never includes the password). */
export interface User {
  email: string;
  role: Role;
  /** Group id, the literal "all" for all-access admins, or undefined. */
  groupId?: string;
  /** Guest accounts only: epoch ms after which the account is auto-deleted. */
  expiresAt?: number;
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
  groupId?: string;
  expiresAt?: number;
}

/** Default lifetime of a guest (temporary) account, in days. */
export const GUEST_DEFAULT_DAYS = 7;

/** The permanent owner's email (kept for display + the isOwner fallback). */
export const OWNER_EMAIL = "admin1@mun.app";

/** Sentinel group id meaning "this admin can access every group". */
export const ALL_GROUPS = "all";

/* -------------------------------- Pure helpers -------------------------------- */

/** A friendly display name derived from an email (the part before the "@"). */
export function displayName(user: User | null | undefined): string {
  if (!user) return "";
  return user.email.split("@")[0] || user.email;
}

/** True for any account that can reach admin areas (owner counts as admin). */
export function isAdmin(role: Role | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** True for temporary guest accounts (committee page + settings only). */
export function isGuest(role: Role | undefined): boolean {
  return role === "guest";
}

/** True only for the permanent Owner account. */
export function isOwner(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === "owner" || user.email.toLowerCase() === OWNER_EMAIL;
}

/** True if the user can see every group (the Owner, or an all-access admin). */
export function canViewAllGroups(user: User | null | undefined): boolean {
  if (!user) return false;
  return isOwner(user) || user.groupId === ALL_GROUPS;
}

/** The group id stored on the user (or undefined). */
export function getActorGroupId(user: User | null | undefined): string | undefined {
  return user?.groupId;
}

/* ------------------------------- API client ---------------------------------- */

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || "Request failed.";
    throw new Error(msg);
  }
  return data as T;
}

function toUser(account: AccountDetail): User {
  return {
    email: account.email,
    role: account.role,
    groupId: account.groupId,
    expiresAt: account.expiresAt,
  };
}

/** Authenticate; the server sets an httpOnly session cookie on success. */
export async function signIn(email: string, password: string): Promise<User> {
  const { account } = await api<{ account: AccountDetail }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return toUser(account);
}

/** End the session (clears the cookie). */
export async function signOut(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
}

/** The current session (re-validated server-side), or null. */
export async function getValidatedSession(): Promise<User | null> {
  try {
    const { account } = await api<{ account: AccountDetail | null }>("/api/auth/me");
    return account ? toUser(account) : null;
  } catch {
    return null;
  }
}

/** The signed-in user's full account (profile + join date). */
export async function getMyAccount(): Promise<AccountDetail | null> {
  const { account } = await api<{ account: AccountDetail | null }>("/api/auth/me");
  return account;
}

/** The accounts the signed-in admin/owner is allowed to see. */
export async function getAccounts(): Promise<AccountDetail[]> {
  const { accounts } = await api<{ accounts: AccountDetail[] }>("/api/accounts");
  return accounts;
}

export async function createAccount(
  email: string,
  password: string,
  role: "admin" | "chair" | "normal" | "guest",
  groupId?: string,
  expiresAt?: number
): Promise<void> {
  await api("/api/accounts", {
    method: "POST",
    body: JSON.stringify({ email, password, role, groupId, expiresAt }),
  });
}

export async function setRole(
  email: string,
  role: "admin" | "chair" | "normal" | "guest"
): Promise<void> {
  await api("/api/accounts", {
    method: "PATCH",
    body: JSON.stringify({ email, role }),
  });
}

/** Change a guest account's expiry timestamp (admins/owner). */
export async function setExpiry(email: string, expiresAt: number): Promise<void> {
  await api("/api/accounts", {
    method: "PATCH",
    body: JSON.stringify({ email, expiresAt }),
  });
}

export async function setGroup(
  email: string,
  groupId: string | undefined
): Promise<void> {
  await api("/api/accounts", {
    method: "PATCH",
    body: JSON.stringify({ email, groupId: groupId ?? null }),
  });
}

export async function deleteAccount(email: string): Promise<void> {
  await api(`/api/accounts?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

/* ---------------------------- Self-service (me) ------------------------------- */

export async function updateProfile(profile: Profile): Promise<Profile> {
  const { profile: saved } = await api<{ profile: Profile }>("/api/account", {
    method: "PATCH",
    body: JSON.stringify({ action: "profile", profile }),
  });
  return saved;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await api("/api/account", {
    method: "PATCH",
    body: JSON.stringify({ action: "password", currentPassword, newPassword }),
  });
}

export async function changeEmail(
  newEmail: string,
  currentPassword: string
): Promise<{ email: string; oldEmail: string }> {
  return api<{ email: string; oldEmail: string }>("/api/account", {
    method: "PATCH",
    body: JSON.stringify({ action: "email", newEmail, currentPassword }),
  });
}
