// Post-build: write this build's asset list and a version hash into out/sw.js.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const OUT = "out";
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(js|css|woff2)$/.test(entry.name)) files.push("/" + relative(OUT, full).split(sep).join("/"));
  }
}
await walk(join(OUT, "_next", "static"));
files.sort();

const version = "gh-" + createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
const swPath = join(OUT, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace('const VERSION = "gh-dev";', `const VERSION = "${version}";`).replace("const BUILD_ASSETS = [];", `const BUILD_ASSETS = ${JSON.stringify(files)};`);
if (!sw.includes(version)) throw new Error("sw.js placeholders not found");
await writeFile(swPath, sw);
console.log(`sw.js: ${version}, ${files.length} assets precached`);
