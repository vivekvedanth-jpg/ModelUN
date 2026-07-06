"use client";

import { useEffect, useMemo, useState } from "react";
import { getAccounts, type AccountDetail } from "@/lib/auth";
import { getAllExperiences, PLACEMENTS, type MunExperience } from "@/lib/experience";
import {
  getRankingSettings,
  setPointsMap,
  resetPointsMap,
  setManualOrder,
  clearManualOrder,
  setAwardNames,
  awardLabel,
  computeLeaderboard,
  DEFAULT_POINTS,
} from "@/lib/ranking";
import { AwardIcon, ArrowUpIcon, ArrowDownIcon, CrownIcon } from "./icons";

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}`;
}

type RankFilter = "all" | "admins" | "delegates";

const FILTERS: { value: RankFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "admins", label: "Admins & Owner" },
  { value: "delegates", label: "Delegates only" },
];

export default function RankingBoard() {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [experiences, setExperiences] = useState<MunExperience[]>([]);
  const [points, setPoints] = useState<Record<string, number>>(DEFAULT_POINTS);
  const [names, setNames] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<RankFilter>("all");

  useEffect(() => {
    Promise.all([
      getAccounts().catch(() => [] as AccountDetail[]),
      getAllExperiences().catch(() => [] as MunExperience[]),
      getRankingSettings().catch(() => ({
        points: DEFAULT_POINTS,
        manualOrder: [] as string[],
        awardNames: {} as Record<string, string>,
      })),
    ]).then(([accts, exps, settings]) => {
      setAccounts(accts);
      setExperiences(exps);
      setPoints(settings.points);
      setOrder(settings.manualOrder);
      setNames(settings.awardNames);
    });
  }, []);

  const leaderboard = useMemo(
    () => computeLeaderboard(accounts, experiences, points, order),
    [accounts, experiences, points, order]
  );

  // Admins & owner are everyone who isn't a plain delegate (owner/admin/chair).
  const visible = useMemo(() => {
    if (filter === "admins") return leaderboard.filter((r) => r.role !== "normal");
    if (filter === "delegates") return leaderboard.filter((r) => r.role === "normal");
    return leaderboard;
  }, [leaderboard, filter]);

  function flash(msg: string, isError = false) {
    setError(isError ? msg : "");
    setNotice(isError ? "" : msg);
    window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 3000);
  }

  function updatePoint(placement: string, value: string) {
    const n = Number(value);
    const clamped = Number.isFinite(n) ? Math.min(1000, Math.max(0, n)) : 0;
    setPoints((prev) => ({ ...prev, [placement]: clamped }));
  }

  function updateName(placement: string, value: string) {
    setNames((prev) => ({ ...prev, [placement]: value }));
  }

  /** Only the placements whose display name actually differs from canonical. */
  function customNames(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of PLACEMENTS) {
      const v = names[p]?.trim();
      if (v && v !== p) out[p] = v;
    }
    return out;
  }

  async function saveAwards() {
    setSaving(true);
    try {
      await Promise.all([setPointsMap(points), setAwardNames(customNames())]);
      flash("Awards & points saved.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to save.", true);
    } finally {
      setSaving(false);
    }
  }

  async function resetAwards() {
    if (!window.confirm("Reset award names and points to their defaults?")) return;
    setSaving(true);
    try {
      const [defaults] = await Promise.all([resetPointsMap(), setAwardNames({})]);
      setPoints(defaults);
      setNames({});
      flash("Reset to defaults.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to reset.", true);
    } finally {
      setSaving(false);
    }
  }

  async function move(email: string, dir: -1 | 1) {
    const emails = leaderboard.map((r) => r.email);
    const i = emails.indexOf(email);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= emails.length) return;
    const prev = order;
    [emails[i], emails[j]] = [emails[j], emails[i]];
    setOrder(emails); // optimistic
    try {
      await setManualOrder(emails);
    } catch (err) {
      setOrder(prev); // roll back on failure
      flash(err instanceof Error ? err.message : "Couldn't save the new order.", true);
    }
  }

  async function resetOrder() {
    try {
      await clearManualOrder();
      setOrder([]);
      flash("Order reset to score ranking.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to reset order.", true);
    }
  }

  const manual = order.length > 0;

  return (
    <div className="space-y-12">
      {/* Awards & points editor */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Awards &amp; points</h2>
        <p className="mt-1 text-navy-600">
          Rename any award to match your circuit (e.g. &ldquo;Honorable Mention&rdquo;
          → &ldquo;Commendable Delegate&rdquo;) and set how many points each is worth.
        </p>

        <div className="mt-6 space-y-2.5">
          <div className="hidden grid-cols-[1fr_auto] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-navy-400 sm:grid">
            <span>Award — display name</span>
            <span className="w-20 text-right">Points</span>
          </div>
          {PLACEMENTS.map((p) => (
            <div
              key={p}
              className="grid grid-cols-1 items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <input
                  type="text"
                  className="input-field !py-2 text-sm font-medium"
                  placeholder={p}
                  value={names[p] ?? ""}
                  onChange={(e) => updateName(p, e.target.value)}
                  aria-label={`Display name for ${p}`}
                />
                <span className="mt-1 block pl-1 text-xs text-navy-400">
                  Standard name: {p}
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={1000}
                className="w-full rounded-lg border border-navy-200 px-2 py-2 text-right text-sm focus:border-navy-500 focus:outline-none sm:w-20"
                value={points[p] ?? 0}
                onChange={(e) => updatePoint(p, e.target.value)}
                aria-label={`Points for ${p}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={saveAwards} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={resetAwards} disabled={saving} className="btn-ghost">
            Reset to defaults
          </button>
          {notice && (
            <span className="text-sm font-medium text-green-700">{notice}</span>
          )}
          {error && (
            <span className="text-sm font-medium text-red-600">{error}</span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-navy-900">Leaderboard</h2>
            <p className="mt-1 text-navy-600">
              {filter !== "all"
                ? `Showing ${filter === "admins" ? "admins & owner" : "delegates"} only. Switch to Everyone to reorder.`
                : manual
                ? "Manually ordered. Use the arrows to rearrange, or reset to score order."
                : "Ranked by total score. Use the arrows to set a custom order."}
            </p>
          </div>
          {manual && filter === "all" && (
            <button onClick={resetOrder} className="btn-ghost !py-2">
              Reset to score order
            </button>
          )}
        </div>

        {/* Filter: everyone / admins+owner / delegates */}
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl border border-navy-100 bg-navy-50 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                filter === f.value
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-navy-600 hover:text-navy-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
                <AwardIcon width={24} height={24} />
              </span>
              <p className="font-semibold text-navy-800">
                {filter === "admins"
                  ? "No ranked admins yet"
                  : "No ranked delegates yet"}
              </p>
              <p className="max-w-sm text-sm text-navy-500">
                Once {filter === "admins" ? "admins" : "delegates"} log conferences in
                &quot;My MUNs&quot;, they&apos;ll appear here ranked by score.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Rank</th>
                  <th className="px-5 py-3 font-semibold">Delegate</th>
                  <th className="px-5 py-3 font-semibold">MUNs</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  {filter === "all" && (
                    <th className="px-5 py-3 text-right font-semibold">Reorder</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {visible.map((row, i) => (
                  <tr key={row.email} className="hover:bg-navy-50/50">
                    <td className="px-5 py-3 text-lg font-bold text-navy-900">
                      {medal(i)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                          {row.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-semibold text-navy-900">
                            {row.name}
                            {row.role !== "normal" && (
                              <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-gold-600">
                                <CrownIcon width={12} height={12} />
                                {row.role === "owner"
                                  ? "Owner"
                                  : row.role === "chair"
                                  ? "Chair"
                                  : "Admin"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-navy-500">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-navy-700">{row.count}</td>
                    <td className="px-5 py-3">
                      <span className="badge bg-gold-100 text-gold-700">
                        {row.score} pts
                      </span>
                    </td>
                    {filter === "all" && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => move(row.email, -1)}
                            disabled={i === 0}
                            aria-label="Move up"
                            className="rounded-lg border border-navy-200 p-1.5 text-navy-700 hover:bg-navy-50 disabled:opacity-30"
                          >
                            <ArrowUpIcon width={14} height={14} />
                          </button>
                          <button
                            onClick={() => move(row.email, 1)}
                            disabled={i === visible.length - 1}
                            aria-label="Move down"
                            className="rounded-lg border border-navy-200 p-1.5 text-navy-700 hover:bg-navy-50 disabled:opacity-30"
                          >
                            <ArrowDownIcon width={14} height={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
