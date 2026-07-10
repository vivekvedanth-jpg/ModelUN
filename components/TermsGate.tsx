"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { acceptTerms } from "@/lib/auth";
import { ShieldIcon, CheckIcon } from "./icons";

/**
 * Shown once, right after a user's first sign-in, until they accept the
 * data-usage terms. Blocks interaction (no dismiss) so consent is explicit;
 * the acceptance is recorded on the account so it never shows again.
 */
export default function TermsGate() {
  const { user, loading, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Nothing to do until we know who's signed in and whether they've accepted.
  if (loading || !user || user.acceptedTermsAt) return null;

  async function handleAccept() {
    setSaving(true);
    setError("");
    try {
      await acceptTerms();
      await refresh(); // pulls the new acceptedTermsAt, which unmounts this gate
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
            <ShieldIcon width={22} height={22} />
          </span>
          <h2 className="text-xl font-bold text-navy-900">
            Before you get started
          </h2>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-navy-700">
          <p>
            Welcome to Let&apos;s MUN. So you know how your information is
            handled:
          </p>
          <ul className="space-y-2">
            {[
              "We collect your account details and platform activity for our use only — to run Let's MUN and make it better.",
              "We use this data to improve our lessons and tools and help more delegates succeed. We never sell it.",
              "Your data stays within Let's MUN and is only accessible to your club's administrators and our team.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-400">
                  <CheckIcon width={10} height={10} />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-navy-500">
            Read the full details on our{" "}
            <Link href="/goals" className="font-semibold text-navy-800 underline">
              Goals &amp; data page
            </Link>
            . By continuing you accept these terms.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={handleAccept}
          disabled={saving}
          className="btn-primary mt-6 w-full"
        >
          {saving ? "Saving…" : "I Understand & Accept"}
        </button>
      </div>
    </div>
  );
}
