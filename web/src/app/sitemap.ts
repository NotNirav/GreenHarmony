import type { MetadataRoute } from "next";
import { plants } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/plants/", "/plan/", "/insights/", "/sources/"].map((path) => ({
    url: SITE_URL + path,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
  return [...pages, ...plants.map((p) => ({ url: `${SITE_URL}/plants/${p.slug}/`, changeFrequency: "monthly" as const, priority: 0.6 }))];
}
