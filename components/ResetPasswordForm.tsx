"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { CheckIcon } from "./icons";

export default function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!email || !token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-900">Invalid reset link</h1>
        <p className="mt-2 text-navy-600">
          This password reset link is missing or malformed. Request a new one
          below.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-6 inline-flex">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
          <CheckIcon width={26} height={26} />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-navy-900">Password updated</h1>
        <p className="mt-2 text-navy-600">
          Your password has been reset. Sign in with your new password.
        </p>
        <button onClick={() => router.push("/signin")} className="btn-primary mt-6">
          Go to Sign In
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email, token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold text-navy-900">Reset your password</h1>
      <p className="mt-2 text-navy-600">
        Choose a new password for <strong>{email}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="password" className="label">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input-field"
            placeholder="At least 4 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="confirm" className="label">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="input-field"
            placeholder="Re-enter your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </>
  );
}
