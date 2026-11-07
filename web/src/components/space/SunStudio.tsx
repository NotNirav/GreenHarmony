"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Pause, Play, Sun } from "lucide-react";
import { dayTimeline, floorAt, sunSituation } from "@/lib/space/sunmap";
import type { Point3 } from "@/lib/space/types";
import type { City, SpaceProfile, Zone } from "@/lib/space/types";
import { MONTHS_LONG } from "./labels";
import { MonthSlider } from "./MonthSlider";
import { SkyView } from "./SkyView";

const START = 6;
const END = 19;
const STEP = 1 / 12; // animate in 5-minute steps
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

export function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh >= 12 ? "pm" : "am";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function runs(tl: { hour: number; light: number }[]): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (const t of tl) {
    if (t.light > 0.25 && start === null) start = t.hour;
    if (t.light <= 0.25 && start !== null) {
      out.push([start, t.hour]);
      start = null;
    }
  }
  if (start !== null) out.push([start, tl[tl.length - 1].hour + 0.25]);
  return out;
}

/**
 * Makes the sun model visible: pick a month and a time of day (or press play) and see where
 * the sun comes from, a side cut-away of your space with its rays, which part of the floor is lit,
 * and when each growing spot gets sun.
 */
export function SunStudio({ profile, city, zones, initialMonth }: { profile: SpaceProfile; city: City; zones: Zone[]; initialMonth?: number }) {
  const [month, setMonth] = useState(initialMonth ?? new Date().getMonth() + 1);
  const [hour, setHour] = useState(10);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setHour((h) => {
        if (h >= END - 0.25) {
          setPlaying(false);
          return END - 0.25;
        }
        return Math.round((h + STEP) * 12) / 12;
      });
    }, 70);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  const sit = useMemo(() => sunSituation(profile, city, month, hour), [profile, city, month, hour]);
  const [spotId, setSpotId] = useState(zones[0]?.id);
  const spot = zones.find((z) => z.id === spotId) ?? zones[0];
  const eye: Point3 | null = useMemo(() => {
    if (!spot?.points.length) return null;
    const n = spot.points.length;
    return spot.points.reduce((a, q) => ({ x: a.x + q.x / n, y: a.y + q.y / n, z: a.z + q.z / n }), { x: 0, y: 0, z: 0 });
  }, [spot]);
  const cols = Math.max(3, Math.min(10, Math.round((profile.width / Math.max(0.3, profile.depth)) * 5)));
  const gridRows = Math.max(2, Math.min(8, Math.round(cols * (profile.depth / Math.max(0.3, profile.width)))));
  const top = useMemo(() => floorAt(profile, city, month, hour, cols, gridRows), [profile, city, month, hour, cols, gridRows]);
  const timelines = useMemo(() => zones.map((z) => ({ z, tl: dayTimeline(profile, city, z.points, month) })), [profile, city, zones, month]);

  const litShare = top.flat().reduce((a, b) => a + b, 0) / Math.max(1, cols * gridRows);
  const where = COMPASS[Math.round(sit.azimuth / 45) % 8];
  const status =
    sit.state === "night"
      ? "The sun is down."
      : sit.state === "behind"
        ? `The sun is in the ${where}, behind your building: no direct sun on your ${profile.kind === "windowsill" ? "sill" : "space"} right now.`
        : litShare > 0.02
          ? `The sun is in the ${where}, ${Math.round(sit.altitude)}° up, lighting about ${Math.round(litShare * 100)}% of your floor.`
          : `The sun is in the ${where}, but the ${profile.railing === "solid" ? "parapet, " : ""}roof or buildings in front block it from your floor.`;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!playing && hour >= END - 0.25) setHour(START);
            setPlaying((v) => !v);
          }}
          aria-label={playing ? "Pause" : "Play the day"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg"
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold tabular-nums">{fmtHour(hour)}</span>
            <span className="text-xs text-muted">{MONTHS_LONG[month - 1]}</span>
          </div>
          <input
            type="range"
            min={START}
            max={END - 0.25}
            step={0.25}
            value={hour}
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            aria-label="Time of day"
            className="h-8 w-full cursor-pointer accent-[var(--warm)]"
          />
        </div>
      </div>
      <p className="flex items-start gap-2 text-sm text-ink-2" aria-live="polite">
        {sit.state === "night" ? <Moon className="mt-0.5 size-4 shrink-0 text-muted" /> : <Sun className="mt-0.5 size-4 shrink-0 text-warm" />}
        {status}
      </p>

      {eye && spot && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-sm font-bold">What a plant sees from</p>
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                aria-pressed={z.id === spot.id}
                onClick={() => setSpotId(z.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${z.id === spot.id ? "bg-ink text-bg" : "bg-subtle text-ink-2 hover:bg-subtle-2"}`}
              >
                {z.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Looking out from the {spot.label.toLowerCase()}: the dark shapes are your own roof, walls and railing; the grey block is the building in front. Where the
            sun&apos;s path is bright, sun reaches this spot.
          </p>
          <div className="mt-3">
            <SkyView profile={profile} city={city} month={month} hour={hour} point={eye} spotLabel={spot.label} />
          </div>
        </div>
      )}
      <TopView profile={profile} grid={top} />

      {/* When each spot gets sun */}
      <div>
        <p className="text-sm font-bold">When each spot gets direct sun</p>
        <div className="mt-1 flex justify-between pl-[112px] text-[10px] text-muted">
          {[6, 9, 12, 15, 18].map((h) => (
            <span key={h}>{h === 12 ? "noon" : h < 12 ? `${h}am` : `${h - 12}pm`}</span>
          ))}
        </div>
        <ul className="mt-1 space-y-2.5">
          {timelines.map(({ z, tl }) => {
            const rs = runs(tl);
            const total = tl.reduce((a, t) => a + t.light * 0.25, 0);
            return (
              <li key={z.id} className="flex items-center gap-3">
                <span className="w-[100px] shrink-0 truncate text-xs font-semibold">{z.label}</span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-subtle-2">
                  {rs.map(([a, b]) => (
                    <span
                      key={a}
                      className="absolute inset-y-0 rounded-full bg-warm"
                      style={{ left: `${((a - START) / (END - START)) * 100}%`, width: `${((b - a) / (END - START)) * 100}%` }}
                    />
                  ))}
                  <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${((hour - START) / (END - START)) * 100}%` }} aria-hidden />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{total.toFixed(1)}h</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">
          {timelines
            .map(({ z, tl }) => {
              const rs = runs(tl);
              return rs.length ? `${z.label}: ${rs.map(([a, b]) => `${fmtHour(a)}–${fmtHour(b)}`).join(", ")}` : `${z.label}: no direct sun`;
            })
            .join(" · ")}
        </p>
      </div>

      <MonthSlider month={month} onChange={setMonth} />
    </div>
  );
}

/** Top-down floor at this moment: lit cells in sun colour, railing / window at the top. */
function TopView({ profile, grid }: { profile: SpaceProfile; grid: number[][] }) {
  const cols = grid[0]?.length ?? 1;
  return (
    <figure>
      <div className="h-1 rounded-full bg-ink-2" aria-hidden />
      <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="img" aria-label="Your floor from above, lit parts in sun colour">
        {grid.flatMap((row, r) =>
          row.map((v, c) => (
            <span
              key={`${r}-${c}`}
              className="h-5 rounded-sm transition-colors duration-150"
              style={{ background: v > 0.02 ? `color-mix(in srgb, var(--warm) ${Math.round(40 + v * 60)}%, var(--subtle-2))` : "var(--subtle-2)" }}
            />
          )),
        )}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>Floor from above · {profile.kind === "windowsill" || profile.kind === "indoor" ? "window" : "railing"} at top</span>
        <span>back</span>
      </figcaption>
    </figure>
  );
}
