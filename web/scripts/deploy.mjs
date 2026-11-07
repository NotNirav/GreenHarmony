// Build with the production URL and deploy the static export (out/) to Vercel.
// One-time setup: `npx vercel login`. Then: `npm run deploy`.
import { execSync } from "node:child_process";

const SITE_URL = "https://greenharmony-mu.vercel.app";
const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  // Links out/ to the existing Vercel project without interactive prompts.
  VERCEL_ORG_ID: "team_h5Y1zsePsJE03qSKQhymRuOQ",
  VERCEL_PROJECT_ID: "prj_kVeWVt5LrpkzpprZm4EPikdvNl07",
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npm run build");
run("npx --yes vercel@latest deploy out --prod --yes");
console.log(`\nLive at ${SITE_URL}`);
