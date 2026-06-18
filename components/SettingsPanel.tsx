"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import {
  changePassword,
  changeEmail,
  updateProfile,
  getProfile,
  getJoinDate,
  isAdmin,
  isOwner,
} from "@/lib/auth";
import { reassignExperienceOwner } from "@/lib/experience";
import { reassignAuthor } from "@/lib/qa";
import { reassignDocumentOwner } from "@/lib/documents";
import {
  GearIcon,
  MailIcon,
  LockIcon,
  ShieldIcon,
  CrownIcon,
  UsersIcon,
  CalendarIcon,
} from "./icons";

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        {notice}
      </p>
    );
  }
  return null;
}

export default function SettingsPanel() {
  const { user, refresh, signOut } = useAuth();
  const router = useRouter();

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailNotice, setEmailNotice] = useState("");

  // Change password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwNotice, setPwNotice] = useState("");

  // Profile details
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [phone, setPhone] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [joinedAt, setJoinedAt] = useState<number | undefined>(undefined);

  // Load the saved profile once we know who's signed in.
  useEffect(() => {
    if (!user) return;
    const p = getProfile(user.email);
    setFullName(p.fullName ?? "");
    setClassName(p.className ?? "");
    setSection(p.section ?? "");
    setPhone(p.phone ?? "");
    setJoinedAt(getJoinDate(user.email));
  }, [user]);

  if (!user) return null;

  const roleLabel = isOwner(user)
    ? "Owner"
    : isAdmin(user.role)
    ? "Admin"
    : "Delegate";

  function handleEmailChange(e: FormEvent) {
    e.preventDefault();
    setEmailError("");
    setEmailNotice("");
    try {
      const { oldEmail, user: updated } = changeEmail(
        user,
        newEmail,
        emailPassword
      );
      // Keep the delegate's records pointing at their new email.
      reassignExperienceOwner(oldEmail, updated.email);
      reassignAuthor(oldEmail, updated.email);
      reassignDocumentOwner(oldEmail, updated.email);
      refresh();
      setNewEmail("");
      setEmailPassword("");
      setEmailNotice(`Email updated to ${updated.email}.`);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileNotice("");
    try {
      updateProfile(user, { fullName, className, section, phone });
      setProfileNotice("Profile saved.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwNotice("");
    if (newPw !== confirmPw) {
      setPwError("New passwords don't match.");
      return;
    }
    try {
      changePassword(user, currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwNotice("Password updated.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Account summary */}
      <div className="card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
            <GearIcon width={22} height={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy-900">Account</h2>
            <p className="text-sm text-navy-500">Your sign-in details and role.</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-navy-50 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              Email
            </dt>
            <dd className="mt-1 font-semibold text-navy-900">{user.email}</dd>
          </div>
          <div className="rounded-xl bg-navy-50 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              Role
            </dt>
            <dd className="mt-1 inline-flex items-center gap-1 font-semibold text-navy-900">
              {isOwner(user) ? (
                <CrownIcon width={15} height={15} />
              ) : isAdmin(user.role) ? (
                <ShieldIcon width={15} height={15} />
              ) : null}
              {roleLabel}
            </dd>
          </div>
          {joinedAt && (
            <div className="rounded-xl bg-navy-50 px-4 py-3 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                Member since
              </dt>
              <dd className="mt-1 inline-flex items-center gap-1 font-semibold text-navy-900">
                <CalendarIcon width={15} height={15} />
                {new Date(joinedAt).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Profile details */}
      <form onSubmit={handleProfileSave} className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
            <UsersIcon width={22} height={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy-900">Profile details</h2>
            <p className="text-sm text-navy-500">
              Your name and class so the team knows who you are. Visible to admins.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="full-name" className="label">Full name</label>
          <input
            id="full-name"
            className="input-field"
            placeholder="e.g. Vivek Vedanth"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="class" className="label">Class / Grade</label>
            <input
              id="class"
              className="input-field"
              placeholder="e.g. 11"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="section" className="label">Section</label>
            <input
              id="section"
              className="input-field"
              placeholder="e.g. B"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="label">Phone number</label>
          <input
            id="phone"
            type="tel"
            className="input-field"
            placeholder="e.g. +1 555 0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <Feedback error={profileError} notice={profileNotice} />

        <button type="submit" className="btn-primary">Save profile</button>
      </form>

      {/* Change email */}
      <form onSubmit={handleEmailChange} className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
            <MailIcon width={22} height={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy-900">Change email</h2>
            <p className="text-sm text-navy-500">
              You&apos;ll use this new email to sign in. Your history moves with you.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="new-email" className="label">New email</label>
          <input
            id="new-email"
            type="email"
            className="input-field"
            placeholder="you@school.edu"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="email-pw" className="label">Confirm with your password</label>
          <input
            id="email-pw"
            type="password"
            autoComplete="current-password"
            className="input-field"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            required
          />
        </div>

        <Feedback error={emailError} notice={emailNotice} />

        <button type="submit" className="btn-primary">Update email</button>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
            <LockIcon width={22} height={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy-900">Change password</h2>
            <p className="text-sm text-navy-500">Keep your account secure.</p>
          </div>
        </div>

        <div>
          <label htmlFor="current-pw" className="label">Current password</label>
          <input
            id="current-pw"
            type="password"
            autoComplete="current-password"
            className="input-field"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-pw" className="label">New password</label>
            <input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              className="input-field"
              placeholder="At least 4 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="label">Confirm new password</label>
            <input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              className="input-field"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
            />
          </div>
        </div>

        <Feedback error={pwError} notice={pwNotice} />

        <button type="submit" className="btn-primary">Update password</button>
      </form>

      {/* Sign out */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Sign out</h2>
          <p className="text-sm text-navy-500">End your session on this device.</p>
        </div>
        <button
          onClick={() => {
            signOut();
            router.push("/");
          }}
          className="btn-ghost"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
