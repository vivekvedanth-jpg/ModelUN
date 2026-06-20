"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { isAdmin, isOwner, type Role } from "@/lib/auth";

interface ProtectedProps {
  /** If set, only users with this role may view the page. */
  role?: Role;
  children: ReactNode;
}

/**
 * Client-side route guard.
 * - Not signed in            -> redirect to /signin
 * - Signed in, wrong role    -> redirect to /
 * - Otherwise                -> render children
 *
 * NOTE: this is UX-level protection only. Real authorization must live on the
 * server once a backend is added.
 */
export default function Protected({ role, children }: ProtectedProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // When a page asks for role="admin", the Owner counts as an admin too.
  // When a page asks for role="chair", the Owner may oversee it as well.
  // role="owner" is strictly the Owner.
  const allowed =
    !!user &&
    (!role ||
      user.role === role ||
      (role === "admin" && isAdmin(user.role)) ||
      (role === "chair" && (user.role === "chair" || isAdmin(user.role))) ||
      (role === "owner" && isOwner(user)));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [user, loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-navy-500">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-navy-200 border-t-navy-800" />
          <span className="text-sm font-medium">Checking your credentials…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
