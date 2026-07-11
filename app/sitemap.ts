import type { MetadataRoute } from "next";
import { blogPostsCol } from "@/lib/server/db";

const SITE_URL = "https://letsmun.com";

export const dynamic = "force-dynamic";

/**
 * The pages a signed-out visitor (and Google) can actually reach without
 * hitting a login wall. Everything behind <Protected> is left out — it would
 * just show Google a redirect. Published blog posts are added dynamically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/goals`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  let posts: MetadataRoute.Sitemap = [];
  try {
    const published = await (await blogPostsCol()).find({ published: true }).toArray();
    posts = published.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    /* if the store is briefly unavailable, still return the static routes */
  }

  return [...staticEntries, ...posts];
}
