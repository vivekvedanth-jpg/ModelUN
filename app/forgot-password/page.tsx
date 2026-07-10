"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import { CheckIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <CheckIcon width={26} height={26} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-navy-900">Check your email</h1>
          <p className="mt-2 text-navy-600">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a
            link to reset the password. It&apos;s valid for 1 hour.
          </p>
          <Link href="/signin" className="btn-ghost mt-6">
            Back to Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold text-navy-900">Forgot your password?</h1>
      <p className="mt-2 text-navy-600">
        Enter your account email and we&apos;ll send you a link to reset it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input-field"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-600">
        <Link
          href="/signin"
          className="font-semibold text-navy-800 underline-offset-2 hover:underline"
        >
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
