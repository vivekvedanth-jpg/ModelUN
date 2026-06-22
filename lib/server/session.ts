/**
 * SERVER-ONLY session helpers: a signed JWT in an httpOnly cookie. The cookie
 * only stores the user's email; role/group are always read fresh from the DB so
 * permission changes take effect immediately.
 */

import { type NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { usersCol, ALL_GROUPS, type UserDoc } from "./db";

const COOKIE = "mun_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set.");
  return s;
}

export function setSessionCookie(res: NextResponse, email: string): void {
  const token = jwt.sign({ email }, secret(), { expiresIn: "30d" });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The signed-in user (fresh from the DB), or null. */
export async function getSessionUser(req: NextRequest): Promise<UserDoc | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  let email: string;
  try {
    email = (jwt.verify(token, secret()) as { email: string }).email;
  } catch {
    return null;
  }
  const users = await usersCol();
  return users.findOne({ email });
}

export function isAdminDoc(u: UserDoc | null): boolean {
  return !!u && (u.role === "admin" || u.role === "owner");
}

export function isOwnerDoc(u: UserDoc | null): boolean {
  return !!u && u.role === "owner";
}

export function canViewAllGroups(u: UserDoc): boolean {
  return u.role === "owner" || u.groupId === ALL_GROUPS;
}

/** A Mongo filter for the accounts a given admin/owner is allowed to see. */
export function visibleAccountsFilter(u: UserDoc): Record<string, unknown> {
  if (canViewAllGroups(u)) return {};
  // Group-scoped admins see their group and themselves — plus the Owner, whose
  // profile (email, phone, MUNs) is visible to every admin.
  if (!u.groupId) return { $or: [{ email: u.email }, { role: "owner" }] };
  return { $or: [{ groupId: u.groupId }, { email: u.email }, { role: "owner" }] };
}

/** Small helper for JSON error responses. */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
