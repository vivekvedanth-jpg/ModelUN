import { Suspense } from "react";
import BlogEditor from "@/components/BlogEditor";

export default function BlogWritePage() {
  return (
    // BlogEditor reads ?id via useSearchParams, which needs a Suspense boundary.
    <Suspense fallback={<div className="container-page py-20 text-navy-500">Loading…</div>}>
      <BlogEditor />
    </Suspense>
  );
}
