"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { getGroups, createGroup, deleteGroup, type Group } from "@/lib/groups";
import { getAccounts, ALL_GROUPS, type AccountDetail } from "@/lib/auth";
import {
  UsersIcon,
  PlusIcon,
  TrashIcon,
  ShieldIcon,
  CrownIcon,
} from "./icons";

function displayName(a: AccountDetail): string {
  return a.profile.fullName?.trim() || a.email.split("@")[0];
}

export default function GroupManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const [grps, accts] = await Promise.all([getGroups(), getAccounts()]);
      setGroups(grps);
      setAccounts(accts);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    run(async () => {
      await createGroup(newName);
      setNewName("");
    }, `Group "${name}" created.`);
  }

  function handleDelete(g: Group) {
    if (
      !window.confirm(
        `Delete the group "${g.name}"? Its members will simply become ungrouped (no accounts are deleted).`
      )
    )
      return;
    run(() => deleteGroup(g.id), `Group "${g.name}" deleted.`);
  }

  const allAccessAdmins = accounts.filter(
    (a) => a.role === "admin" && a.groupId === ALL_GROUPS
  );

  function MemberRow({ a }: { a: AccountDetail }) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-2.5">
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            a.role === "admin" ? "bg-gold-500 text-navy-900" : "bg-navy-800 text-white"
          }`}
        >
          {displayName(a).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold text-navy-900">
            {displayName(a)}
          </div>
          <div className="truncate text-xs text-navy-500">{a.email}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Create a group */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Create a group</h2>
        <p className="mt-1 text-navy-600">
          A group is a club, school, or university. Assign admins to a group in
          Delegate Affairs and they&apos;ll only see that group&apos;s members.
        </p>
        <form
          onSubmit={handleCreate}
          className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-gold-300 bg-gold-50/60 p-6"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Springfield High MUN"
            aria-label="Group name"
            className="input-field max-w-sm flex-1"
            required
          />
          <button type="submit" className="btn-gold">
            <PlusIcon width={16} height={16} /> Create group
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

      {/* Groups */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Groups</h2>
        <p className="mt-1 text-navy-600">
          Click a group to see its admins and students.
        </p>

        {groups.length === 0 ? (
          <div className="mt-6 card flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
              <UsersIcon width={24} height={24} />
            </span>
            <p className="font-semibold text-navy-800">No groups yet</p>
            <p className="max-w-sm text-sm text-navy-500">
              Create your first group above, then assign admins and delegates to
              it from Delegate Affairs.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {groups.map((g) => {
              const members = accounts.filter((a) => a.groupId === g.id);
              const admins = members.filter((a) => a.role === "admin");
              const students = members.filter((a) => a.role === "normal");
              const isOpen = expandedId === g.id;
              return (
                <Fragment key={g.id}>
                  <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
                    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : g.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                          <UsersIcon width={20} height={20} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-bold text-navy-900">
                            {g.name}
                          </div>
                          <div className="text-xs text-navy-500">
                            {students.length}{" "}
                            {students.length === 1 ? "student" : "students"} ·{" "}
                            {admins.length}{" "}
                            {admins.length === 1 ? "admin" : "admins"}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon width={14} height={14} /> Delete
                      </button>
                    </div>

                    {isOpen && (
                      <div className="space-y-5 border-t border-navy-100 bg-navy-50/40 px-5 py-5">
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-500">
                            <ShieldIcon width={14} height={14} /> Admins
                          </p>
                          {admins.length === 0 ? (
                            <p className="text-sm text-navy-500">
                              No admins assigned to this group yet.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {admins.map((a) => (
                                <MemberRow key={a.email} a={a} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-500">
                            <UsersIcon width={14} height={14} /> Students
                          </p>
                          {students.length === 0 ? (
                            <p className="text-sm text-navy-500">
                              No students in this group yet.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {students.map((a) => (
                                <MemberRow key={a.email} a={a} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* All-access admins */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">
          Admins with access to all groups
        </h2>
        <p className="mt-1 text-navy-600">
          These admins can see every group&apos;s members.
        </p>
        <div className="mt-4">
          {allAccessAdmins.length === 0 ? (
            <p className="text-sm text-navy-500">
              None yet — create an admin with the all groups option in Delegate
              Affairs.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {allAccessAdmins.map((a) => (
                <div
                  key={a.email}
                  className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-2.5"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-900">
                    <CrownIcon width={15} height={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-navy-900">
                      {displayName(a)}
                    </div>
                    <div className="truncate text-xs text-navy-500">
                      {a.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
