"use client";

import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";

/**
 * Renders its children only when the current user is an admin (or the owner).
 * Use this to gate "upload" controls and other admin-only UI inside
 * otherwise-shared pages.
 */
export default function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!isAdmin(user?.role)) return null;
  return <>{children}</>;
}
