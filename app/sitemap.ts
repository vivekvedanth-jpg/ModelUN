import type { MetadataRoute } from "next";

const SITE_URL = "https://letsmun.com";

/**
 * Only the pages a signed-out visitor (and Google) can actually reach without
 * hitting a login wall belong here — everything else (committee, editor,
 * settings, admin, resources, videos, …) sits behind <Protected> and would
 * just show Google a redirect, which wastes crawl budget and looks thin.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
