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
  computeLeaderboard,
  DEFAULT_POINTS,
} from "@/lib/ranking";
import { AwardIcon, ArrowUpIcon, ArrowDownIcon, CrownIcon } from "./icons";

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}`;
}

export default function RankingBoard() {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [experiences, setExperiences] = useState<MunExperience[]>([]);
  const [points, setPoints] = useState<Record<string, number>>(DEFAULT_POINTS);
  const [order, setOrder] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      getAccounts().catch(() => [] as AccountDetail[]),
      getAllExperiences().catch(() => [] as MunExperience[]),
      getRankingSettings().catch(() => ({ points: DEFAULT_POINTS, manualOrder: [] })),
    ]).then(([accts, exps, settings]) => {
      setAccounts(accts);
      setExperiences(exps);
      setPoints(settings.points);
      setOrder(settings.manualOrder);
    });
  }, []);

  const leaderboard = useMemo(
    () => computeLeaderboard(accounts, experiences, points, order),
    [accounts, experiences, points, order]
  );

  function updatePoint(placement: string, value: string) {
    const n = Number(value);
    setPoints((prev) => ({ ...prev, [placement]: Number.isFinite(n) ? n : 0 }));
  }

  async function savePoints() {
    try {
      await setPointsMap(points);
      setNotice("Points saved.");
    } catch {
      setNotice("Failed to save points.");
    }
    window.setTimeout(() => setNotice(""), 2500);
  }

  async function resetPoints() {
    try {
      const defaults = await resetPointsMap();
      setPoints(defaults);
      setNotice("Points reset to defaults.");
    } catch {
      setNotice("Failed to reset points.");
    }
    window.setTimeout(() => setNotice(""), 2500);
  }

  async function move(email: string, dir: -1 | 1) {
    const emails = leaderboard.map((r) => r.email);
    const i = emails.indexOf(email);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= emails.length) return;
    [emails[i], emails[j]] = [emails[j], emails[i]];
    setOrder(emails);
    await setManualOrder(emails).catch(() => {});
  }

  async function resetOrder() {
    try {
      await clearManualOrder();
      setOrder([]);
      setNotice("Order reset to score ranking.");
    } catch {
      setNotice("Failed to reset order.");
    }
    window.setTimeout(() => setNotice(""), 2500);
  }

  const manual = order.length > 0;

  return (
    <div className="space-y-12">
      {/* Points editor */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Scoring</h2>
        <p className="mt-1 text-navy-600">
          Set how many points each award is worth. Scores update instantly.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEMENTS.map((p) => (
            <label key={p} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3">
              <span className="text-sm font-medium text-navy-800">{p}</span>
              <input
                type="number"
                min={0}
                className="w-20 rounded-lg border border-navy-200 px-2 py-1.5 text-right text-sm focus:border-navy-500 focus:outline-none"
                value={points[p] ?? 0}
                onChange={(e) => updatePoint(p, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={savePoints} className="btn-primary">Save points</button>
          <button onClick={resetPoints} className="btn-ghost">Reset to defaults</button>
          {notice && (
            <span className="text-sm font-medium text-green-700">{notice}</span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-navy-900">Leaderboard</h2>
            <p className="mt-1 text-navy-600">
              {manual
                ? "Manually ordered. Use the arrows to rearrange, or reset to score order."
                : "Ranked by total score. Use the arrows to set a custom order."}
            </p>
          </div>
          {manual && (
            <button onClick={resetOrder} className="btn-ghost !py-2">
              Reset to score order
            </button>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white">
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
                <AwardIcon width={24} height={24} />
              </span>
              <p className="font-semibold text-navy-800">No ranked delegates yet</p>
              <p className="max-w-sm text-sm text-navy-500">
                Once delegates log conferences in &quot;My MUNs&quot;, they&apos;ll appear
                here ranked by score.
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
                  <th className="px-5 py-3 text-right font-semibold">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {leaderboard.map((row, i) => (
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
                          disabled={i === leaderboard.length - 1}
                          aria-label="Move down"
                          className="rounded-lg border border-navy-200 p-1.5 text-navy-700 hover:bg-navy-50 disabled:opacity-30"
                        >
                          <ArrowDownIcon width={14} height={14} />
                        </button>
                      </div>
                    </td>
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
