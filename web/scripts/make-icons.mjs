// Renders the leaf logo into the app icons (home screen, favicon, Apple touch).
// Run: node scripts/make-icons.mjs   (writes to public/ and src/app/)
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const GREEN = "#157a43";
const LEAF = "M11.2 21.5v-6.3C6.4 15 3 11.6 3 6.6V4.5h1.6c3.3 0 5.8 1.5 7 4 1.4-3.3 4.4-5.3 8.2-5.3H21v2.2c0 5.6-3.7 9.3-8.8 9.7v6.4h-1Z";

/** A square icon; `inset` is how much of the canvas the leaf fills, `radius` the corner rounding. */
function svg({ size, inset, radius }) {
  const leaf = size * inset;
  const offset = (size - leaf) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${GREEN}"/>
  <g transform="translate(${offset} ${offset}) scale(${leaf / 24})"><path d="${LEAF}" fill="#fff"/></g>
</svg>`;
}

const png = (opts, file) => sharp(Buffer.from(svg(opts))).png().toFile(file);

await png({ size: 192, inset: 0.62, radius: 0.22 }, "public/icon-192.png");
await png({ size: 512, inset: 0.62, radius: 0.22 }, "public/icon-512.png");
// Maskable: full-bleed background, leaf inside the 80% safe zone.
await png({ size: 512, inset: 0.5, radius: 0 }, "public/icon-maskable-512.png");
// Apple adds its own rounding.
await png({ size: 180, inset: 0.6, radius: 0 }, "src/app/apple-icon.png");
await writeFile("src/app/icon.svg", svg({ size: 64, inset: 0.66, radius: 0.22 }));
console.log("icons written");
