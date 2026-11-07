"use client";

import { useMemo } from "react";
import { floorGrid } from "@/lib/space/sunmap";
import type { City, SpaceProfile } from "@/lib/space/types";
import { FACING_LABEL, MONTHS_LONG } from "./labels";

/** Same words the plant pages use for sun needs. */
const BANDS = [
  { min: 6, label: "Full sun", sub: "6 h+", mix: 100 },
  { min: 3, label: "Part sun", sub: "3–6 h", mix: 62 },
  { min: 1, label: "Bright shade", sub: "1–3 h", mix: 30 },
  { min: -1, label: "Shade", sub: "<1 h", mix: 0 },
];
const bandFor = (h: number) => BANDS.find((b) => h >= b.min)!;

function cellStyle(h: number): React.CSSProperties {
  const b = bandFor(h);
  return b.mix === 0 ? { background: "var(--subtle-2)" } : { background: `color-mix(in srgb, var(--warm) ${b.mix}%, var(--subtle-2))` };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmt = (h: number) => (h >= 10 ? Math.round(h) : Math.round(h * 2) / 2).toString();

/** One plain-English sentence explaining the pattern on the map. */
function explain(profile: SpaceProfile, hours: number[][]): string {
  const all = hours.flat();
  const front = avg(hours[0]);
  const back = avg(hours[hours.length - 1]);
  const left = avg(hours.map((r) => r[0]));
  const right = avg(hours.map((r) => r[r.length - 1]));
  const opening = profile.kind === "windowsill" || profile.kind === "indoor" ? "window" : profile.kind === "terrace" ? "edge" : "railing";
  const barrier = profile.railing === "solid" ? "solid wall" : profile.railing === "grill" ? "grill" : profile.railing === "glass" ? "glass railing" : "edge";

  if (Math.max(...all) < 1) return "Almost no direct sun reaches here this month, so we stick to plants that like shade.";
  let s: string;
  if (back > front + 1.5) {
    s = profile.railing === "solid" || profile.railing === "grill"
      ? `The strip just behind your ${barrier} gets only ~${fmt(front)} h because the ${barrier} blocks the sun, while further in gets ~${fmt(back)} h.`
      : `The back gets more sun (~${fmt(back)} h) than the front (~${fmt(front)} h) this month.`;
  } else if (front > back + 1.5) {
    s = `Sun is strongest near the ${opening} (~${fmt(front)} h) and fades towards the back (~${fmt(back)} h)${profile.ceiling !== null && profile.kind !== "terrace" ? "; the roof stops the high sun reaching deeper" : ""}.`;
  } else {
    s = `Sun is fairly even across the floor, about ${fmt(avg(all))} h a day.`;
  }
  if (Math.abs(left - right) > 1.5) {
    s += ` The ${left > right ? "left" : "right"} side (looking out) gets more; ${profile.sides !== "none" ? "a side wall shades the other side" : "the sun comes in at an angle"}.`;
  }
  return s;
}

/**
 * Top-down map of the floor: each cell shows hours of direct sun on a typical day of the month.
 * The open side (railing / window) is at the top.
 */
export function SunHeatmap({ profile, city, month, className = "" }: { profile: SpaceProfile; city: City; month: number; className?: string }) {
  const grid = useMemo(() => floorGrid(profile, city, month, 7), [profile, city, month]);
  const ratio = Math.min(2.4, Math.max(0.7, profile.width / Math.max(0.25, profile.depth)));
  const opening = profile.kind === "windowsill" || profile.kind === "indoor" ? "Window" : profile.kind === "terrace" ? "Open edge" : "Railing side";
  const sideL = profile.kind === "balcony" && profile.sides !== "none";
  const sideR = profile.kind === "balcony" && profile.sides === "both";
  const showNumbers = grid.cols <= 8;

  return (
    <figure className={className}>
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span className="uppercase tracking-wide">{opening}</span>
        <span>faces {FACING_LABEL[profile.facing].toLowerCase()} ↑</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-ink-2" aria-hidden />
      <div
        className={`mt-1.5 grid gap-1 ${sideL ? "border-l-4 border-ink-2 pl-1" : ""} ${sideR ? "border-r-4 border-ink-2 pr-1" : ""}`}
        style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, aspectRatio: `${ratio}` }}
        role="img"
        aria-label={`Sun map for ${MONTHS_LONG[month - 1]}`}
      >
        {grid.hours.flatMap((row, r) =>
          row.map((h, c) => (
            <div
              key={`${r}-${c}`}
              className={`grid place-items-center rounded-md text-[11px] font-bold tabular-nums ${bandFor(h).mix === 100 ? "text-bg" : "text-ink-2"}`}
              style={cellStyle(h)}
              title={`${h} h direct sun`}
            >
              {showNumbers && `${fmt(h)}h`}
            </div>
          )),
        )}
      </div>
      <p className="mt-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted">{profile.kind === "indoor" ? "Room" : "Back wall"}</p>

      <figcaption className="mt-4 space-y-3">
        <p className="text-pretty text-sm text-ink-2">{explain(profile, grid.hours)}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          {BANDS.map((b) => (
            <li key={b.label} className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={cellStyle(b.min === -1 ? 0 : b.min)} />
              <span className="font-semibold text-ink-2">{b.label}</span> {b.sub}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
