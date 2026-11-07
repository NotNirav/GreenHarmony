/** Public origin of the deployed site (set NEXT_PUBLIC_SITE_URL when building for production). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "GreenHarmony";
export const SITE_TAGLINE = "Climate-smart balcony gardens for India";
