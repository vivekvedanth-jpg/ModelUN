"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import { ArrowRightIcon } from "./icons";

interface HomeCTAProps {
  /** Label shown to visitors who are not signed in. */
  signedOutLabel: string;
  /** "gold" = primary button, "link" = inline text link. */
  variant?: "gold" | "link";
}

/**
 * A call-to-action that adapts to auth state. Signed-out visitors are sent to
 * sign in; signed-in users never see a "Sign In" prompt — they get a link that
 * continues into the app instead.
 */
export default function HomeCTA({ signedOutLabel, variant = "gold" }: HomeCTAProps) {
  const { user } = useAuth();

  const href = user ? (isAdmin(user.role) ? "/admin" : "/resources") : "/signin";
  const label = user
    ? isAdmin(user.role)
      ? "Open Dashboard"
      : "Continue Learning"
    : signedOutLabel;

  if (variant === "link") {
    return (
      <Link
        href={href}
        className="mt-8 inline-flex items-center gap-2 font-semibold text-navy-800 underline-offset-4 hover:underline"
      >
        {label} <ArrowRightIcon width={18} height={18} />
      </Link>
    );
  }

  return (
    <Link href={href} className="btn-gold w-full sm:w-auto">
      {label} <ArrowRightIcon width={18} height={18} />
    </Link>
  );
}
