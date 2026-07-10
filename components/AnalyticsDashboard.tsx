"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { canViewAnalytics } from "@/lib/auth";
import { getAnalytics, type Analytics } from "@/lib/analytics";
import PageHeader from "./PageHeader";
import {
  UsersIcon,
  AwardIcon,
  GlobeIcon,
  PlayIcon,
  BookIcon,
  ScaleIcon,
  SparkleIcon,
  ShieldIcon,
} from "./icons";

/** "2026-07" → "Jul". */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, {
    month: "short",
  });
}

export default function AnalyticsDashboard() {
  const { user, loading } = useAuth();
  const allowed = canViewAnalytics(user);

  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowed) return;
    getAnalytics().then(setData).catch((e) => setError(e.message));
  }, [allowed]);

  const maxSignups = useMemo(
    () => Math.max(1, ...(data?.signupsByMonth.map((s) => s.count) ?? [])),
    [data]
  );

  if (!loading && !allowed) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Analytics" />
        <section className="container-page py-16">
          <div className="card max-w-lg">
            <h2 className="text-lg font-bold text-navy-900">
              Analytics access required
            </h2>
            <p className="mt-2 text-navy-600">
              This dashboard is limited to the Owner and admins the Owner has
              granted access. Ask the Owner to enable it for your account from{" "}
              <Link href="/admin/affairs" className="font-semibold underline">
                Delegate Affairs
              </Link>
              .
            </p>
          </div>
        </section>
      </>
    );
  }

  const t = data?.totals;

  const tiles = t
    ? [
        { icon: UsersIcon, label: "Students", value: t.students, accent: true },
        { icon: GlobeIcon, label: "Schools / clubs", value: t.groups },
        { icon: ScaleIcon, label: "Conferences logged", value: t.conferencesLogged },
        { icon: AwardIcon, label: "Awards won", value: t.awardsWon },
        { icon: ShieldIcon, label: "Chairs", value: t.chairs },
        { icon: PlayIcon, label: "Lesson videos", value: t.videos },
        { icon: BookIcon, label: "Resources", value: t.resources },
        { icon: UsersIcon, label: "Total accounts", value: t.accounts },
      ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform Analytics"
        description="A live snapshot of activity across Let's MUN — the numbers to share with schools and universities considering the platform."
      />

      <section className="container-page space-y-12 py-12 sm:py-16">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {!data && !error && (
          <p className="text-navy-500">Loading analytics…</p>
        )}

        {data && (
          <>
            {/* Headline tiles */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map(({ icon: Icon, label, value, accent }) => (
                <div
                  key={label}
                  className={`card ${accent ? "ring-2 ring-gold-300" : ""}`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      accent
                        ? "bg-gold-500 text-navy-900"
                        : "bg-navy-50 text-navy-800"
                    }`}
                  >
                    <Icon width={22} height={22} />
                  </span>
                  <div className="mt-4 font-serif text-3xl font-bold text-navy-900">
                    {value.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-navy-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Engagement */}
            <div>
              <h2 className="text-2xl font-bold text-navy-900">Engagement</h2>
              <p className="mt-1 text-navy-600">
                How actively delegates use the platform — based on real logged
                activity, not estimates.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <div className="card">
                  <div className="font-serif text-3xl font-bold text-navy-900">
                    {data.engagement.activeStudentRate}%
                  </div>
                  <div className="mt-1 text-sm text-navy-500">
                    of students have logged MUN experience
                  </div>
                </div>
                <div className="card">
                  <div className="font-serif text-3xl font-bold text-navy-900">
                    {data.engagement.avgConferencesPerActive}
                  </div>
                  <div className="mt-1 text-sm text-navy-500">
                    avg. conferences per active delegate
                  </div>
                </div>
                <div className="card">
                  <div className="font-serif text-3xl font-bold text-navy-900">
                    {data.engagement.awardRate}%
                  </div>
                  <div className="mt-1 text-sm text-navy-500">
                    of logged conferences resulted in an award
                  </div>
                </div>
              </div>
            </div>

            {/* Signups over time */}
            <div>
              <h2 className="text-2xl font-bold text-navy-900">
                New accounts — last 6 months
              </h2>
              <div className="card mt-5">
                <div className="flex items-end justify-between gap-3 sm:gap-6">
                  {data.signupsByMonth.map((s) => (
                    <div key={s.month} className="flex flex-1 flex-col items-center gap-2">
                      <div className="text-sm font-bold text-navy-800">
                        {s.count}
                      </div>
                      <div
                        className="w-full max-w-[3rem] rounded-t-md bg-navy-800"
                        style={{
                          height: `${Math.max(4, (s.count / maxSignups) * 140)}px`,
                        }}
                      />
                      <div className="text-xs font-medium text-navy-500">
                        {monthLabel(s.month)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Per-school breakdown */}
            <div>
              <h2 className="text-2xl font-bold text-navy-900">
                By school / club
              </h2>
              <p className="mt-1 text-navy-600">
                Where your delegates come from — useful when pitching to a
                specific institution.
              </p>
              {data.groups.length === 0 ? (
                <p className="mt-4 text-sm text-navy-500">
                  No groups yet. Create schools or clubs on the Groups page.
                </p>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-navy-100 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">School / club</th>
                        <th className="px-5 py-3 text-right font-semibold">Students</th>
                        <th className="px-5 py-3 text-right font-semibold">Chairs</th>
                        <th className="px-5 py-3 text-right font-semibold">Admins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {data.groups.map((g) => (
                        <tr key={g.id} className="hover:bg-navy-50/50">
                          <td className="px-5 py-3 font-semibold text-navy-900">
                            {g.name}
                          </td>
                          <td className="px-5 py-3 text-right text-navy-700">{g.students}</td>
                          <td className="px-5 py-3 text-right text-navy-700">{g.chairs}</td>
                          <td className="px-5 py-3 text-right text-navy-700">{g.admins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="flex items-center gap-2 text-xs text-navy-400">
              <SparkleIcon width={14} height={14} />
              Snapshot generated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </section>
    </>
  );
}
