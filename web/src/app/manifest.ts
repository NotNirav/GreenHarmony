import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME}: ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: "Plants that thrive on your Indian balcony, a sun map of your space, and a garden plan that updates with the seasons.",
    lang: "en-IN",
    start_url: "/garden/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#157a43",
    categories: ["lifestyle", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My garden", url: "/garden/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Find a plant", url: "/plants/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
