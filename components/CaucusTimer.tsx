"use client";

import { useEffect, useRef, useState } from "react";

const PRESETS = [
  { label: "0:30", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "5:00", seconds: 300 },
];

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Plays a short beep using the Web Audio API (no asset needed). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — fail silently */
  }
}

export default function CaucusTimer() {
  const [total, setTotal] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState(1);
  const [customSec, setCustomSec] = useState(0);
  const beeped = useRef(false);

  // Tick once per second while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Stop + beep exactly once when the clock hits zero.
  useEffect(() => {
    if (remaining === 0 && running && !beeped.current) {
      beeped.current = true;
      setRunning(false);
      beep();
    }
    if (remaining > 0) beeped.current = false;
  }, [remaining, running]);

  function applyDuration(seconds: number) {
    setRunning(false);
    setTotal(seconds);
    setRemaining(seconds);
    beeped.current = false;
  }

  function applyCustom() {
    const seconds = Math.max(1, customMin * 60 + customSec);
    applyDuration(seconds);
  }

  function toggle() {
    if (remaining === 0) return;
    setRunning((v) => !v);
  }

  function reset() {
    setRunning(false);
    setRemaining(total);
    beeped.current = false;
  }

  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const isFinished = remaining === 0;
  const isLow = remaining <= 10 && remaining > 0;

  const displayColor = isFinished
    ? "text-red-600"
    : isLow
    ? "text-red-500"
    : "text-navy-900";
  const barColor = isFinished || isLow ? "bg-red-500" : "bg-gold-500";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 sm:p-10">
        {/* Display */}
        <div className="text-center">
          <span className="eyebrow justify-center">
            {isFinished ? "Time!" : running ? "In session" : "Ready"}
          </span>
          <div
            className={`mt-3 font-mono text-7xl font-bold tabular-nums sm:text-8xl ${displayColor} ${
              isLow || isFinished ? "animate-pulse" : ""
            }`}
          >
            {format(remaining)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-navy-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-linear ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Controls */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={toggle}
            disabled={isFinished}
            className={running ? "btn-ghost !px-8" : "btn-primary !px-8"}
          >
            {running ? "Pause" : remaining === total ? "Start" : "Resume"}
          </button>
          <button onClick={reset} className="btn-ghost">
            Reset
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-6">
        <p className="label">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.seconds}
              onClick={() => applyDuration(p.seconds)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                total === p.seconds
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-navy-200 bg-white text-navy-700 hover:border-navy-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom duration */}
      <div className="mt-6 card">
        <p className="label">Custom duration</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-navy-500">Minutes</label>
            <input
              type="number"
              min={0}
              max={59}
              value={customMin}
              onChange={(e) =>
                setCustomMin(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }
              className="input-field w-24"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-navy-500">Seconds</label>
            <input
              type="number"
              min={0}
              max={59}
              value={customSec}
              onChange={(e) =>
                setCustomSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }
              className="input-field w-24"
            />
          </div>
          <button onClick={applyCustom} className="btn-gold">
            Set timer
          </button>
        </div>
      </div>
    </div>
  );
}
