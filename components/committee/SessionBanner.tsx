"use client";

import { useEffect, useState } from "react";
import { setSession, clearSession, type Committee } from "@/lib/committee";
import { ClockIcon } from "../icons";

const PRESETS = [
  "Moderated Caucus",
  "Unmoderated Caucus",
  "Lunch Break",
  "Voting Procedure",
  "Suspended",
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionBanner({
  committee,
  canManage,
  onUpdate,
}: {
  committee: Committee;
  canManage: boolean;
  onUpdate: (c: Committee) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [label, setLabel] = useState("");
  const [mins, setMins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const s = committee.session;
  const remaining =
    s && s.durationSec != null
      ? Math.max(0, Math.ceil((s.startedAt + s.durationSec * 1000 - now) / 1000))
      : null;

  async function start(presetLabel?: string) {
    const finalLabel = (presetLabel ?? label).trim();
    if (!finalLabel) return;
    setBusy(true);
    setError("");
    try {
      const dur = mins.trim() ? Math.round(Number(mins) * 60) : undefined;
      const u = await setSession(committee.id, {
        label: finalLabel,
        durationSec: dur && dur > 0 ? dur : undefined,
      });
      onUpdate(u);
      setLabel("");
      setMins("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      onUpdate(await clearSession(committee.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      {s ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ClockIcon width={20} height={20} />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                Currently in session
              </div>
              <div className="text-lg font-bold text-navy-900">{s.label}</div>
            </div>
          </div>
          {remaining != null && (
            <span
              className={`rounded-xl px-4 py-2 font-mono text-2xl font-bold tabular-nums ${
                remaining === 0
                  ? "bg-red-100 text-red-700"
                  : "bg-navy-900 text-white"
              }`}
            >
              {remaining === 0 ? "Time!" : fmt(remaining)}
            </span>
          )}
          {canManage && (
            <button onClick={clear} disabled={busy} className="btn-ghost !py-2 text-sm">
              End / clear
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-navy-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
            <ClockIcon width={20} height={20} />
          </span>
          <span className="text-sm">
            {canManage ? "Set what the committee is doing right now." : "Session hasn't started yet."}
          </span>
        </div>
      )}

      {canManage && (
        <div className="mt-4 border-t border-navy-100 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="label" htmlFor="session-label">Activity</label>
              <input
                id="session-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Unmoderated Caucus"
                className="input-field !py-2"
              />
            </div>
            <div className="w-28">
              <label className="label" htmlFor="session-mins">Minutes</label>
              <input
                id="session-mins"
                type="number"
                min={0}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                placeholder="optional"
                className="input-field no-spin !py-2"
              />
            </div>
            <button onClick={() => start()} disabled={busy || !label.trim()} className="btn-primary !py-2.5">
              Set
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => start(p)}
                disabled={busy}
                className="badge border border-navy-200 bg-white px-2.5 py-1 text-xs text-navy-600 hover:border-navy-400"
              >
                {p}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
