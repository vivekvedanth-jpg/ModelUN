import type { Metadata } from "next";
import { Suspense } from "react";
import SearchResults from "@/components/SearchResults";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Let's MUN blog posts, lesson videos, and resources.",
};

export default function SearchPage() {
  return (
    // SearchResults uses useSearchParams, which needs a Suspense boundary.
    <Suspense fallback={<div className="container-page py-20 text-navy-500">Loading…</div>}>
      <SearchResults />
    </Suspense>
  );
}
