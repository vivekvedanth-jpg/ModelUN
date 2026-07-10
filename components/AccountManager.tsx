"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import {
  getAccounts,
  createAccount,
  setRole,
  setGroup,
  setExpiry,
  setAnalyticsAccess,
  deleteAccount,
  isOwner,
  canViewAllGroups,
  getActorGroupId,
  ALL_GROUPS,
  GUEST_DEFAULT_DAYS,
  type Role,
  type AccountDetail,
} from "@/lib/auth";
import { getGroups, type Group } from "@/lib/groups";
import {
  getAllExperiences,
  deleteExperience,
  type MunExperience,
} from "@/lib/experience";
import {
  UsersIcon,
  PlusIcon,
  TrashIcon,
  CrownIcon,
  ShieldIcon,
  ScaleIcon,
  AwardIcon,
  CalendarIcon,
  ClockIcon,
  SparkleIcon,
} from "./icons";

/** The expiry durations offered when creating or extending a guest account. */
const GUEST_DURATIONS = [3, 7, 14, 30] as const;
const DAY_MS = 86_400_000;

type NewRole = "admin" | "chair" | "normal" | "guest";

/** The account types offered in the create form, with what each one can do. */
const ROLE_OPTIONS: {
  value: NewRole;
  label: string;
  desc: string;
  Icon: typeof UsersIcon;
  ownerOnly?: boolean;
}[] = [
  {
    value: "normal",
    label: "Delegate",
    desc: "A student. Logs MUN experience and joins committees.",
    Icon: UsersIcon,
  },
  {
    value: "chair",
    label: "Chair",
    desc: "Runs a committee and scores its delegates.",
    Icon: ScaleIcon,
  },
  {
    value: "guest",
    label: "Guest",
    desc: "Visiting delegate. Auto-deleted when access expires.",
    Icon: ClockIcon,
  },
  {
    value: "admin",
    label: "Admin",
    desc: "Manages accounts. Owner only.",
    Icon: ShieldIcon,
    ownerOnly: true,
  },
];

function roleBadgeClass(role: Role) {
  switch (role) {
    case "owner":
      return "bg-gold-500 text-navy-900";
    case "admin":
      return "bg-gold-100 text-gold-700";
    case "chair":
      return "bg-emerald-100 text-emerald-700";
    case "guest":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-navy-100 text-navy-700";
  }
}

function roleLabel(role: Role): string {
  return role === "owner"
    ? "Owner"
    : role === "admin"
    ? "Admin"
    : role === "chair"
    ? "Chair"
    : role === "guest"
    ? "Guest"
    : "Delegate";
}

/** Whole days remaining until a timestamp (never negative). */
function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / DAY_MS));
}

export default function AccountManager() {
  const { user } = useAuth();
  const owner = isOwner(user);

  const [users, setUsers] = useState<AccountDetail[]>([]);
  const [experiences, setExperiences] = useState<MunExperience[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // New-account form state.
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Admins may create chairs for their own club; only the owner creates admins.
  const [newRole, setNewRole] = useState<NewRole>("normal");
  const [newGroup, setNewGroup] = useState("");
  const [newGuestDays, setNewGuestDays] = useState(GUEST_DEFAULT_DAYS);
  const [groups, setGroups] = useState<Group[]>([]);

  // The owner + all-access admins choose groups; group-scoped admins cannot.
  const canAssignGroups = canViewAllGroups(user);
  const myGroupId = getActorGroupId(user);

  const refresh = async () => {
    try {
      const [accts, grps, exps] = await Promise.all([
        getAccounts(), getGroups(), getAllExperiences(),
      ]);
      setUsers(accts);
      setGroups(grps);
      setExperiences(exps);
    } catch {
      /* ignore — likely not signed in / DB not configured */
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function experiencesFor(email: string): MunExperience[] {
    const lower = email.toLowerCase();
    return experiences.filter((e) => e.owner.toLowerCase() === lower);
  }

  function groupLabel(groupId?: string): string {
    if (groupId === ALL_GROUPS) return "All groups";
    if (!groupId) return "No group";
    return groups.find((g) => g.id === groupId)?.name ?? "No group";
  }

  async function removeExperience(id: string) {
    setError("");
    setNotice("");
    try {
      await deleteExperience(id);
      setExperiences((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function run(action: () => Promise<void>, success: string) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  /** Switching type resets the group so a stale pick can't leak across roles. */
  function pickRole(role: NewRole) {
    setNewRole(role);
    setNewGroup(role === "admin" ? ALL_GROUPS : "");
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const expiresArg =
      newRole === "guest" ? Date.now() + newGuestDays * DAY_MS : undefined;
    const created = newEmail.trim().toLowerCase();
    run(async () => {
      await createAccount(
        newEmail,
        newPassword,
        newRole,
        newGroup || undefined,
        expiresArg
      );
      setNewEmail("");
      setNewPassword("");
      pickRole("normal");
      setNewGuestDays(GUEST_DEFAULT_DAYS);
    }, `Account "${created}" created.`);
  }

  return (
    <div className="space-y-8">
      {/* Create account */}
      <div id="create-account" className="scroll-mt-24">
        <h2 className="text-2xl font-bold text-navy-900">Create an account</h2>
        <p className="mt-1 text-navy-600">
          There is no public sign-up — new accounts can only be added here.
          {owner
            ? " As the Owner you can create any account type, for any group."
            : " You can add delegates, guests and chairs to your group. Only the Owner creates admins."}
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-2xl border-2 border-dashed border-gold-300 bg-gold-50/60 p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-email" className="label">
                Email
              </label>
              <input
                id="new-email"
                type="email"
                autoComplete="off"
                className="input-field"
                placeholder="e.g. delegate@school.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="new-password" className="label">
                Temporary password
              </label>
              <input
                id="new-password"
                type="text"
                className="input-field"
                placeholder="At least 4 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mt-5">
            <span className="label">Account type</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map(({ value, label, desc, Icon, ownerOnly }) => {
                const locked = ownerOnly && !owner;
                const selected = newRole === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pickRole(value)}
                    disabled={locked}
                    title={locked ? "Only the Owner can create admins" : ""}
                    aria-pressed={selected}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${
                      selected
                        ? "border-navy-800 bg-white shadow-sm"
                        : "border-navy-100 bg-white/60 hover:border-navy-300"
                    } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        selected
                          ? "bg-navy-800 text-gold-400"
                          : "bg-navy-50 text-navy-500"
                      }`}
                    >
                      <Icon width={16} height={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-navy-900">
                        {label}
                      </span>
                      <span className="block text-xs leading-snug text-navy-500">
                        {desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guest expiry */}
          {newRole === "guest" && (
            <div className="mt-4">
              <label htmlFor="guest-expiry" className="label">
                Access expires
              </label>
              <select
                id="guest-expiry"
                value={newGuestDays}
                onChange={(e) => setNewGuestDays(Number(e.target.value))}
                className="input-field"
              >
                {GUEST_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-navy-500">
                Guest accounts are for visiting delegates — they only see the
                committee page and are deleted automatically when they expire.
              </p>
            </div>
          )}

          {/* Group assignment */}
          <div className="mt-4">
            <span className="label">
              {newRole === "chair" ? "MUN club (group)" : "Group"}
            </span>
            {canAssignGroups ? (
              <>
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="input-field"
                >
                  {newRole === "admin" ? (
                    <option value={ALL_GROUPS}>All groups (full access)</option>
                  ) : (
                    <option value="">No group</option>
                  )}
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-navy-500">
                  {newRole === "admin"
                    ? "Pick a group to limit this admin to its members, or all groups for full access."
                    : newRole === "chair"
                    ? "The club this chair belongs to. They'll appear under it on the Groups page."
                    : "Which club, school or university this account belongs to."}
                </p>
                {groups.length === 0 && (
                  <p className="mt-1.5 text-xs text-navy-500">
                    No groups yet — create one on the Groups page first.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-navy-600">
                {newRole === "chair" ? "This chair" : "This account"} joins your
                group:{" "}
                <span className="font-semibold">{groupLabel(myGroupId)}</span>
              </p>
            )}
          </div>

          <button type="submit" className="btn-gold mt-5">
            <PlusIcon width={16} height={16} /> Create account
          </button>
        </form>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          {notice}
        </p>
      )}

      {/* All accounts */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">
          {canAssignGroups ? "All accounts" : "Your group"}
        </h2>
        <p className="mt-1 text-navy-600">
          {canAssignGroups
            ? "Every account on the platform. "
            : "Accounts in your group. "}
          {owner
            ? "You can change roles, groups, and remove accounts."
            : "You can remove delegates, guests and your group's chairs; only the Owner manages admins and groups."}
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {users.map((u) => {
                const isSelf =
                  u.email.toLowerCase() === user?.email.toLowerCase();
                const targetIsOwner = u.role === "owner";
                // Who can delete this row? Admins manage delegates, guests and
                // the chairs of the group they can see; only the Owner removes admins.
                const canDelete =
                  !targetIsOwner &&
                  !isSelf &&
                  (owner ||
                    u.role === "normal" ||
                    u.role === "guest" ||
                    u.role === "chair");
                const exps = experiencesFor(u.email);
                const isExpanded = expandedEmail === u.email;
                const fullName = u.profile.fullName?.trim();
                const display = fullName || u.email.split("@")[0];

                return (
                  <Fragment key={u.email}>
                  <tr className="hover:bg-navy-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            u.role === "normal" || u.role === "guest"
                              ? "bg-navy-800 text-white"
                              : "bg-gold-500 text-navy-900"
                          }`}
                        >
                          {display.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-navy-900">
                            {display}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-navy-400">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-navy-500">{u.email}</div>
                          {u.role !== "owner" && (
                            <span className="badge mt-1 bg-navy-50 text-navy-600">
                              {groupLabel(u.groupId)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`badge inline-flex items-center gap-1 ${roleBadgeClass(
                          u.role
                        )}`}
                      >
                        {u.role === "owner" && (
                          <CrownIcon width={13} height={13} />
                        )}
                        {roleLabel(u.role)}
                      </span>
                      {u.role === "guest" && u.expiresAt !== undefined && (
                        <div
                          className={`mt-1 flex items-center gap-1 text-xs ${
                            u.expiresAt - Date.now() < DAY_MS
                              ? "font-semibold text-red-600"
                              : "text-navy-500"
                          }`}
                        >
                          <ClockIcon width={12} height={12} />
                          Expires{" "}
                          {new Date(u.expiresAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {daysLeft(u.expiresAt)}d left
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* View this delegate's MUN experience */}
                        <button
                          onClick={() =>
                            setExpandedEmail(isExpanded ? null : u.email)
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            isExpanded
                              ? "border-navy-800 bg-navy-800 text-white"
                              : "border-navy-200 text-navy-700 hover:bg-navy-50"
                          }`}
                        >
                          <AwardIcon width={14} height={14} /> MUNs ({exps.length})
                        </button>
                        {/* Change role — Owner only, never on the Owner */}
                        {owner && !targetIsOwner && (
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const next = e.target.value as
                                | "admin"
                                | "chair"
                                | "normal"
                                | "guest";
                              run(
                                () => setRole(u.email, next),
                                `${u.email} is now ${roleLabel(next)}.`
                              );
                            }}
                            aria-label={`Change role for ${u.email}`}
                            className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-700 focus:border-navy-500 focus:outline-none"
                          >
                            <option value="normal">Delegate</option>
                            <option value="guest">Guest</option>
                            <option value="chair">Chair</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {/* Extend a guest's access — any admin */}
                        {u.role === "guest" && (
                          <select
                            value=""
                            onChange={(e) => {
                              const days = Number(e.target.value);
                              if (!days) return;
                              run(
                                () =>
                                  setExpiry(
                                    u.email,
                                    Date.now() + days * DAY_MS
                                  ),
                                `Guest access for ${u.email} now expires in ${days} days.`
                              );
                            }}
                            aria-label={`Extend guest access for ${u.email}`}
                            className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-700 focus:border-navy-500 focus:outline-none"
                          >
                            <option value="" disabled>
                              Extend…
                            </option>
                            {GUEST_DURATIONS.map((d) => (
                              <option key={d} value={d}>
                                {d} days
                              </option>
                            ))}
                          </select>
                        )}
                        {/* Assign a group — Owner only; every non-owner role has one */}
                        {owner &&
                          (u.role === "admin" ||
                            u.role === "chair" ||
                            u.role === "normal" ||
                            u.role === "guest") && (
                            <select
                              value={u.groupId ?? ""}
                              onChange={(e) =>
                                run(
                                  () =>
                                    setGroup(
                                      u.email,
                                      e.target.value || undefined
                                    ),
                                  `Group updated for ${u.email}.`
                                )
                              }
                              aria-label={`Change group for ${u.email}`}
                              className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-700 focus:border-navy-500 focus:outline-none"
                            >
                              <option value="">No group</option>
                              {u.role === "admin" && (
                                <option value={ALL_GROUPS}>All groups</option>
                              )}
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          )}
                        {/* Analytics access — Owner only, for admins */}
                        {owner && u.role === "admin" && (
                          <button
                            onClick={() =>
                              run(
                                () =>
                                  setAnalyticsAccess(
                                    u.email,
                                    !u.canViewAnalytics
                                  ),
                                u.canViewAnalytics
                                  ? `Analytics access removed for ${u.email}.`
                                  : `Analytics access granted to ${u.email}.`
                              )
                            }
                            title="Toggle access to the Platform Analytics dashboard"
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                              u.canViewAnalytics
                                ? "border-gold-300 bg-gold-100 text-gold-700"
                                : "border-navy-200 text-navy-600 hover:bg-navy-50"
                            }`}
                          >
                            <SparkleIcon width={13} height={13} />
                            Analytics {u.canViewAnalytics ? "on" : "off"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete the account "${u.email}"? This cannot be undone.`
                                )
                              ) {
                                run(
                                  () => deleteAccount(u.email),
                                  `Account "${u.email}" deleted.`
                                );
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <TrashIcon width={14} height={14} /> Delete
                          </button>
                        )}
                        {targetIsOwner && (
                          <span className="inline-flex items-center gap-1 text-xs text-navy-400">
                            <UsersIcon width={14} height={14} /> Permanent
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-navy-50/40">
                      <td colSpan={3} className="px-5 py-4">
                        {/* Profile details */}
                        <div className="mb-4 flex flex-wrap gap-2 text-xs">
                          {fullName && (
                            <span className="badge bg-white text-navy-700">
                              Name: {fullName}
                            </span>
                          )}
                          {u.profile.className && (
                            <span className="badge bg-white text-navy-700">
                              Class {u.profile.className}
                              {u.profile.section ? ` · Sec ${u.profile.section}` : ""}
                            </span>
                          )}
                          {u.profile.phone && (
                            <span className="badge bg-white text-navy-700">
                              📞 {u.profile.phone}
                            </span>
                          )}
                          {!fullName && !u.profile.className && !u.profile.phone && (
                            <span className="text-navy-400">
                              No profile details added yet.
                            </span>
                          )}
                        </div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
                          MUN experience — {u.email}
                        </p>
                        {exps.length === 0 ? (
                          <p className="text-sm text-navy-500">
                            This delegate hasn&apos;t logged any conferences yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {exps.map((it) => (
                              <div
                                key={it.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-navy-100 bg-white px-4 py-2.5 text-sm"
                              >
                                <span className="font-semibold text-navy-900">
                                  {it.conference}
                                </span>
                                <span className="inline-flex items-center gap-1 text-navy-500">
                                  <CalendarIcon width={13} height={13} /> {it.date}
                                </span>
                                <span className="text-navy-500">· {it.committee}</span>
                                <span className="text-navy-500">· {it.portfolio}</span>
                                <span className="badge ml-auto inline-flex items-center gap-1 bg-gold-100 text-gold-700">
                                  <AwardIcon width={12} height={12} /> {it.placement}
                                </span>
                                {it.scorecardDataUrl && (
                                  <a
                                    href={it.scorecardDataUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={it.scorecardName}
                                    className="text-xs font-semibold text-navy-700 underline hover:text-gold-600"
                                  >
                                    Scorecard
                                  </a>
                                )}
                                <button
                                  onClick={() => removeExperience(it.id)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
