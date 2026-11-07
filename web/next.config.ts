import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: every page is pre-rendered from the JSON datasets at build time.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
