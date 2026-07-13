"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import {
  getResources,
  deleteResource,
  updateResource,
  type Resource,
} from "@/lib/content";
import UploadCard from "./UploadCard";
import { DocumentIcon, ArrowRightIcon, TrashIcon, GearIcon } from "./icons";

const UNCATEGORIZED = "General";

export default function ResourceLibrary() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeCat, setActiveCat] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => getResources().then(setResources).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const categories = useMemo(
    () => Array.from(new Set(resources.map((r) => r.category?.trim() || UNCATEGORIZED))).sort(),
    [resources]
  );
  const knownSubcats = useMemo(
    () => Array.from(new Set(resources.map((r) => r.subcategory?.trim()).filter(Boolean) as string[])).sort(),
    [resources]
  );

  const visible = activeCat === "All"
    ? resources
    : resources.filter((r) => (r.category?.trim() || UNCATEGORIZED) === activeCat);

  // Group visible resources: category → subcategory → resources.
  const grouped = useMemo(() => {
    const byCat = new Map<string, Map<string, Resource[]>>();
    for (const r of visible) {
      const cat = r.category?.trim() || UNCATEGORIZED;
      const sub = r.subcategory?.trim() || "";
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const subMap = byCat.get(cat)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push(r);
    }
    return byCat;
  }, [visible]);

  async function handleDelete(r: Resource) {
    if (window.confirm(`Delete the resource "${r.title}"?`)) {
      try {
        await deleteResource(r.id);
        setResources((prev) => prev.filter((x) => x.id !== r.id));
      } catch { /* ignore */ }
    }
  }

  return (
    <>
      {admin && (
        <div className="mb-10">
          <UploadCard
            kind="resource"
            title="Upload a new resource"
            description="Share a guide, template, or example — and file it under a category."
            cta="Publish resource"
            onAdded={refresh}
            categories={categories.filter((c) => c !== UNCATEGORIZED)}
            subcategories={knownSubcats}
          />
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                activeCat === c
                  ? "bg-navy-800 text-white"
                  : "border border-navy-200 text-navy-700 hover:bg-navy-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {resources.length === 0 && (
        <p className="text-navy-500">No resources yet.</p>
      )}

      {/* Grouped resources */}
      <div className="space-y-12">
        {Array.from(grouped.entries()).map(([cat, subMap]) => (
          <div key={cat}>
            <h2 className="font-serif text-2xl font-bold text-navy-900">{cat}</h2>
            <div className="mt-5 space-y-8">
              {Array.from(subMap.entries()).map(([sub, items]) => (
                <div key={sub || "_none"}>
                  {sub && (
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-600">
                      {sub}
                    </h3>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    {items.map((r) => (
                      <article key={r.id} className="card-hover flex flex-col gap-4">
                        <div className="flex items-start gap-4">
                          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                            <DocumentIcon width={24} height={24} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge bg-navy-100 text-navy-700">{r.type}</span>
                              <span className="badge bg-gold-100 text-gold-700">{r.format}</span>
                            </div>
                            <h3 className="mt-2 font-bold text-navy-900">{r.title}</h3>
                            <p className="mt-1 text-sm text-navy-600">{r.desc}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-4">
                              {r.url ? (
                                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-gold-600">
                                  Open document <ArrowRightIcon width={15} height={15} />
                                </a>
                              ) : (
                                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-gold-600">
                                  Download <ArrowRightIcon width={15} height={15} />
                                </button>
                              )}
                              {admin && (
                                <>
                                  <button onClick={() => setEditingId(editingId === r.id ? null : r.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-900">
                                    <GearIcon width={15} height={15} /> Categorize
                                  </button>
                                  <button onClick={() => handleDelete(r)} className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700">
                                    <TrashIcon width={15} height={15} /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {admin && editingId === r.id && (
                          <CategoryEditor
                            resource={r}
                            categories={categories.filter((c) => c !== UNCATEGORIZED)}
                            subcategories={knownSubcats}
                            onSaved={(updated) => {
                              setResources((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CategoryEditor({
  resource,
  categories,
  subcategories,
  onSaved,
  onCancel,
}: {
  resource: Resource;
  categories: string[];
  subcategories: string[];
  onSaved: (r: Resource) => void;
  onCancel: () => void;
}) {
  const [cat, setCat] = useState(resource.category ?? "");
  const [sub, setSub] = useState(resource.subcategory ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateResource(resource.id, { category: cat.trim(), subcategory: sub.trim() });
      onSaved(updated);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input list={`cat-${resource.id}`} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Category" className="input-field" />
        <datalist id={`cat-${resource.id}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <input list={`sub-${resource.id}`} value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Subcategory" className="input-field" />
        <datalist id={`sub-${resource.id}`}>{subcategories.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary !px-4 !py-2 text-sm">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="btn-ghost !px-4 !py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}
