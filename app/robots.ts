import type { MetadataRoute } from "next";

const SITE_URL = "https://letsmun.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind <Protected> is a login wall to a crawler, not
      // content — indexing it wastes crawl budget and can read as thin/duplicate.
      disallow: [
        "/api/",
        "/admin",
        "/committee",
        "/committee-view",
        "/editor",
        "/experience",
        "/model-diplomat",
        "/resources",
        "/settings",
        "/timer",
        "/videos",
        "/signup",
        // The reset link carries a single-use token in the query string —
        // never let it get crawled, cached, or leaked via a search index.
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
