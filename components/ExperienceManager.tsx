"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import {
  getExperiences,
  addExperience,
  deleteExperience,
  PLACEMENTS,
  MAX_SCORECARD_BYTES,
  type MunExperience,
} from "@/lib/experience";
import {
  AwardIcon,
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  DocumentIcon,
  UploadIcon,
} from "./icons";

function placementClass(placement: string) {
  if (placement === "Best Delegate") return "bg-gold-500 text-navy-900";
  if (placement === "Outstanding Delegate") return "bg-gold-100 text-gold-700";
  if (placement.includes("Mention")) return "bg-navy-100 text-navy-700";
  return "bg-navy-50 text-navy-500";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export default function ExperienceManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<MunExperience[]>([]);

  const [conference, setConference] = useState("");
  const [date, setDate] = useState("");
  const [committee, setCommittee] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [placement, setPlacement] = useState<string>("Participant");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getExperiences(user.email).then(setItems).catch(() => setItems([]));
  }, [user]);

  function resetForm() {
    setConference("");
    setDate("");
    setCommittee("");
    setPortfolio("");
    setPlacement("Participant");
    setNotes("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      let scorecardName: string | undefined;
      let scorecardDataUrl: string | undefined;

      if (file) {
        if (file.size > MAX_SCORECARD_BYTES) {
          setError("That scorecard is over 1.5 MB. Please choose a smaller file.");
          return;
        }
        scorecardName = file.name;
        scorecardDataUrl = await readFileAsDataUrl(file);
      }

      const added = await addExperience({
        conference, date, committee, portfolio, placement, notes,
        scorecardName, scorecardDataUrl,
      });
      setItems((prev) => [added, ...prev]);
      resetForm();
      setNotice("Experience added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleDelete(item: MunExperience) {
    if (!window.confirm(`Remove "${item.conference}" from your experience?`)) return;
    try {
      await deleteExperience(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      {/* Add form */}
      <form
        onSubmit={handleSubmit}
        className="card h-fit space-y-4 lg:sticky lg:top-24"
      >
        <h2 className="text-xl font-bold text-navy-900">Add a conference</h2>

        <div>
          <label htmlFor="conference" className="label">Conference name</label>
          <input
            id="conference"
            className="input-field"
            placeholder="e.g. Harvard MUN 2025"
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="label">Date</label>
            <input
              id="date"
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="committee" className="label">Committee</label>
            <input
              id="committee"
              className="input-field"
              placeholder="e.g. UNSC"
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="portfolio" className="label">Portfolio / Country</label>
          <input
            id="portfolio"
            className="input-field"
            placeholder="e.g. France"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="placement" className="label">Placement / Award</label>
          <select
            id="placement"
            className="input-field"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          >
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notes" className="label">Notes (optional)</label>
          <textarea
            id="notes"
            className="input-field min-h-[70px] resize-y"
            placeholder="Highlights, what you learned, feedback…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Scorecard (optional, image or PDF up to 1.5 MB)</span>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-600 hover:border-navy-400">
            <UploadIcon width={16} height={16} />
            <span className="ml-2 truncate">
              {file ? file.name : "Choose a file"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
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

        <button type="submit" className="btn-primary w-full">
          <PlusIcon width={16} height={16} /> Add experience
        </button>
      </form>

      {/* List */}
      <div>
        <h2 className="text-xl font-bold text-navy-900">
          Your conferences{items.length > 0 && ` (${items.length})`}
        </h2>

        {items.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-navy-200 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
              <AwardIcon width={24} height={24} />
            </span>
            <p className="font-semibold text-navy-800">No conferences logged yet</p>
            <p className="max-w-sm text-sm text-navy-500">
              Add your first MUN on the left — it&apos;ll build your delegate
              résumé here.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {items.map((it) => (
              <article key={it.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-navy-900">{it.conference}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon width={14} height={14} /> {it.date}
                      </span>
                      <span>· {it.committee}</span>
                      <span>· {it.portfolio}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(it)}
                    className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    <TrashIcon width={14} height={14} /> Remove
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`badge inline-flex items-center gap-1 ${placementClass(it.placement)}`}>
                    <AwardIcon width={13} height={13} /> {it.placement}
                  </span>
                  {it.scorecardDataUrl && (
                    <a
                      href={it.scorecardDataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={it.scorecardName}
                      className="badge inline-flex items-center gap-1 bg-navy-100 text-navy-700 hover:bg-navy-200"
                    >
                      <DocumentIcon width={13} height={13} />
                      {it.scorecardName ?? "Scorecard"}
                    </a>
                  )}
                </div>

                {it.notes && (
                  <p className="mt-3 text-sm text-navy-600">{it.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
