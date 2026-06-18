"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin } from "@/lib/auth";
import {
  getResources,
  deleteResource,
  type Resource,
} from "@/lib/content";
import UploadCard from "./UploadCard";
import { DocumentIcon, ArrowRightIcon, TrashIcon } from "./icons";

export default function ResourceLibrary() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    setResources(getResources());
  }, []);

  function handleDelete(r: Resource) {
    if (window.confirm(`Delete the resource "${r.title}"?`)) {
      setResources(deleteResource(r.id));
    }
  }

  return (
    <>
      {admin && (
        <div className="mb-10">
          <UploadCard
            kind="resource"
            title="Upload a new resource"
            description="Share a guide, template, or example with all delegates."
            accept=".pdf,.doc,.docx"
            cta="Publish resource"
            onAdded={() => setResources(getResources())}
          />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {resources.map((r) => (
          <article key={r.id} className="card-hover flex items-start gap-4">
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
              <div className="mt-3 flex items-center gap-4">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-gold-600"
                  >
                    Open document <ArrowRightIcon width={15} height={15} />
                  </a>
                ) : (
                  <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-gold-600">
                    Download <ArrowRightIcon width={15} height={15} />
                  </button>
                )}
                {admin && (
                  <button
                    onClick={() => handleDelete(r)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    <TrashIcon width={15} height={15} /> Delete
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
