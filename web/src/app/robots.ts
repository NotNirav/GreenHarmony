import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // The garden page is personal (stored on the device), so keep it out of search results.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/garden/", "/offline/"] }, sitemap: `${SITE_URL}/sitemap.xml` };
}
