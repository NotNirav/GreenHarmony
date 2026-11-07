"use client";

import { useMemo } from "react";
import { FRONT_DISTANCE, FRONT_RISE, lightAt, openingFor } from "@/lib/space/sunmap";
import { angleDiff, sunPosition } from "@/lib/space/solar";
import type { City, Point3, SpaceProfile } from "@/lib/space/types";

/*
 * Plant's-eye view: a 180° panorama of what a plant at one spot sees looking out of the space.
 * x axis = direction (left edge 90° left of straight out, right edge 90° right), y axis = height
 * above the horizon. Everything is drawn with the same geometry `lightAt` uses, so the sun
 * disappears behind the drawn roof or building exactly when the model says that spot loses sun.
 */

const W = 360;
const DEG = 2; // px per degree
const HORIZON = 90 * DEG; // 90° of sky above the horizon
const H = HORIZON + 45 * DEG; // and 45° below it
const RAD = Math.PI / 180;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
// Outdoor daylight colours, the same in light and dark mode: this is a window onto the outside.
const C = { skyTop: "#8ec6ee", skyLow: "#e3f1fb", ground: "#c9d3c7", building: "#8f979d", solid: "#3b3f45", glass: "#7fb6dc", sun: "#f29a12", text: "#1d2024", halo: "#ffffff" };

const sx = (phi: number) => W / 2 + phi * DEG;
const sy = (el: number) => HORIZON - Math.max(-45, Math.min(90, el)) * DEG;
const deg = (r: number) => r / RAD;

function path(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Elevation (°) at which a ray in direction phi crosses height `h` on the opening plane. */
function elAtOpening(pt: Point3, phi: number, h: number): number {
  const run = Math.max(0.05, pt.x) / Math.cos(phi * RAD);
  return deg(Math.atan2(h - pt.z, run));
}

const PHIS = Array.from({ length: 91 }, (_, i) => -89 + (i * 178) / 90);

export function SkyView({
  profile,
  city,
  month,
  hour,
  point,
  spotLabel,
}: {
  profile: SpaceProfile;
  city: Pick<City, "lat" | "lon">;
  month: number;
  hour: number;
  point: Point3;
  spotLabel: string;
}) {
  const o = useMemo(() => openingFor(profile), [profile]);

  // Sun paths: today's month in detail, June and December faintly for the seasons.
  const paths = useMemo(() => {
    const trace = (m: number) => {
      const out: { x: number; y: number; lit: boolean; hour: number }[] = [];
      for (let h = 5.5; h <= 19.5; h += 1 / 6) {
        const { altitude, azimuth } = sunPosition(city.lat, city.lon, m, 15, h);
        const phi = angleDiff(azimuth, o.facing);
        if (altitude <= 0 || Math.abs(phi) >= 90) continue;
        out.push({ x: sx(phi), y: sy(altitude), lit: lightAt(profile, o, point, altitude, azimuth) > 0.25, hour: h });
      }
      return out;
    };
    return { now: trace(month), jun: trace(6), dec: trace(12) };
  }, [profile, o, city, month, point]);

  const sun = useMemo(() => {
    const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, hour);
    const phi = angleDiff(azimuth, o.facing);
    const light = altitude > 0 ? lightAt(profile, o, point, altitude, azimuth) : 0;
    return { altitude, azimuth, phi, light, inView: altitude > 0 && Math.abs(phi) < 90 };
  }, [profile, o, city, month, hour, point]);

  const walls = !o.open360;
  const ceilingEdge = walls && o.ceiling !== null ? PHIS.map((phi) => [sx(phi), sy(elAtOpening(point, phi, o.ceiling!))] as [number, number]) : null;
  const sillEdge = walls && o.sill > 0 ? PHIS.map((phi) => [sx(phi), sy(elAtOpening(point, phi, o.sill))] as [number, number]) : null;
  const floorEdge = walls ? PHIS.map((phi) => [sx(phi), sy(elAtOpening(point, phi, 0))] as [number, number]) : null;
  // Side walls: rays whose crossing point on the opening plane falls outside the opening's width.
  const leftWallPhi = walls && o.sides !== "none" ? deg(Math.atan2(-point.y, Math.max(0.05, point.x))) : null;
  const rightWallPhi = walls && o.sides === "both" ? deg(Math.atan2(o.width - point.y, Math.max(0.05, point.x))) : null;

  const dist = FRONT_DISTANCE[profile.frontView];
  const rise = FRONT_RISE[profile.frontHeight] - point.z;
  const skyline =
    Number.isFinite(dist) && rise > 0
      ? PHIS.filter((phi) => Math.abs(phi) < 70).map((phi) => [sx(phi), sy(deg(Math.atan2(rise, dist / Math.max(0.35, Math.cos(phi * RAD)))))] as [number, number])
      : null;

  const dirLabel = (phi: number) => COMPASS[Math.round((((o.facing + phi) % 360) + 360) % 360 / 45) % 8];
  const hourMarks = paths.now.filter((p) => Math.abs(p.hour - Math.round(p.hour)) < 0.01 && Math.round(p.hour) % 2 === 1);
  const railFill = profile.railing === "glass" ? C.glass : C.solid;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden rounded-2xl" role="img" aria-label={`What a plant at ${spotLabel} sees, with the sun's path`}>
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={C.skyTop} />
            <stop offset="1" stopColor={C.skyLow} />
          </linearGradient>
          <pattern id="grill" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={C.solid} opacity="0.15" />
            <rect width="2" height="8" fill={C.solid} opacity="0.75" />
          </pattern>
        </defs>
        {/* Sky and ground */}
        <rect width={W} height={HORIZON} fill="url(#sky)" />
        <rect y={HORIZON} width={W} height={H - HORIZON} fill={C.ground} />
        {/* Elevation guides */}
        {[30, 60].map((e) => (
          <g key={e}>
            <line x1={0} x2={W} y1={sy(e)} y2={sy(e)} stroke={C.halo} strokeOpacity={0.7} strokeDasharray="2 4" />
            <text x={W / 2 + 4} y={sy(e) - 3} className="text-[8px]" fill={C.text} fillOpacity={0.6}>
              {e}° up
            </text>
          </g>
        ))}

        {/* Building in front, at its true height from this spot */}
        {skyline && (
          <path d={`${path(skyline)} L${skyline[skyline.length - 1][0]},${H} L${skyline[0][0]},${H} Z`} fill={C.building} />
        )}
        {profile.trees && (
          <g fill="#5f9a62" opacity={0.55}>
            {[-55, -20, 25, 60].map((phi) => (
              <ellipse key={phi} cx={sx(phi)} cy={sy(12)} rx={26} ry={24} />
            ))}
          </g>
        )}

        {/* Seasonal envelope: June (high) and December (low) */}
        {[paths.jun, paths.dec].map((pts, i) =>
          pts.length > 1 ? (
            <g key={i}>
              <path d={path(pts.map((p) => [p.x, p.y]))} fill="none" stroke={C.sun} strokeOpacity={0.75} strokeWidth={1.2} strokeDasharray="1 3" />
              <text x={pts[Math.floor(pts.length / 2)].x} y={pts[Math.floor(pts.length / 2)].y - 4} textAnchor="middle" className="text-[8px] font-semibold" fill={C.text} fillOpacity={0.65}>
                {i === 0 ? "June" : "Dec"}
              </text>
            </g>
          ) : null,
        )}

        {/* Your space: roof, side walls, railing, floor (drawn over the sky they hide) */}
        {ceilingEdge && <path d={`M0,0 L${W},0 L${W},${ceilingEdge[ceilingEdge.length - 1][1]} ${path(ceilingEdge.slice().reverse()).replace("M", "L")} Z`} fill={C.solid} opacity={0.92} />}
        {sillEdge && floorEdge && (
          <path
            d={`${path(sillEdge)} ${path(floorEdge.slice().reverse()).replace("M", "L")} Z`}
            fill={profile.railing === "grill" && profile.kind !== "windowsill" && profile.kind !== "indoor" ? "url(#grill)" : railFill}
            opacity={profile.railing === "glass" ? 0.45 : 0.92}
          />
        )}
        {floorEdge && <path d={`${path(floorEdge)} L${W},${H} L0,${H} Z`} fill={C.solid} opacity={0.7} />}
        {leftWallPhi !== null && <rect x={0} y={0} width={Math.max(0, sx(leftWallPhi))} height={H} fill={C.solid} />}
        {rightWallPhi !== null && <rect x={sx(rightWallPhi)} y={0} width={Math.max(0, W - sx(rightWallPhi))} height={H} fill={C.solid} />}

        {/* Today's sun path: bright where it reaches this spot, faint where something is in the way */}
        {paths.now.map((p, i) =>
          i ? (
            <line
              key={i}
              x1={paths.now[i - 1].x}
              y1={paths.now[i - 1].y}
              x2={p.x}
              y2={p.y}
              stroke={p.lit && paths.now[i - 1].lit ? C.sun : C.halo}
              strokeWidth={p.lit && paths.now[i - 1].lit ? 3.5 : 1.5}
              strokeDasharray={p.lit && paths.now[i - 1].lit ? undefined : "3 3"}
              strokeLinecap="round"
              opacity={p.lit && paths.now[i - 1].lit ? 1 : 0.85}
            />
          ) : null,
        )}
        {hourMarks.map((p) => (
          <g key={p.hour}>
            <circle cx={p.x} cy={p.y} r={2} fill={p.lit ? C.sun : C.halo} />
            <text x={p.x} y={p.y + 12} textAnchor="middle" className="text-[8px] font-semibold" fill={C.text} stroke={C.halo} strokeWidth={2.5} paintOrder="stroke">
              {Math.round(p.hour) === 12 ? "noon" : Math.round(p.hour) < 12 ? `${Math.round(p.hour)}am` : `${Math.round(p.hour) - 12}pm`}
            </text>
          </g>
        ))}

        {/* The sun now */}
        {sun.inView && (
          <g>
            <circle cx={sx(sun.phi)} cy={sy(sun.altitude)} r={15} fill={C.sun} opacity={0.18} />
            <circle cx={sx(sun.phi)} cy={sy(sun.altitude)} r={8} fill={C.sun} stroke={C.halo} strokeWidth={1.5} />
          </g>
        )}
        {!sun.inView && sun.altitude > 0 && (
          <g>
            <path
              d={sun.phi < 0 ? `M14,${sy(25)} l10,-7 v14 z` : `M${W - 14},${sy(25)} l-10,-7 v14 z`}
              fill={C.sun}
            />
            <text x={sun.phi < 0 ? 28 : W - 28} y={sy(25) + 3} textAnchor={sun.phi < 0 ? "start" : "end"} className="text-[9px] font-semibold" fill={C.text} stroke={C.halo} strokeWidth={2.5} paintOrder="stroke">
              sun is behind your building
            </text>
          </g>
        )}

        {/* Labels */}
        {ceilingEdge && (
          <text x={W / 2} y={12} textAnchor="middle" className="text-[9px] font-semibold" fill={C.halo}>
            {profile.kind === "windowsill" || profile.kind === "indoor" ? "wall above the window" : "your ceiling / balcony above"}
          </text>
        )}
        {sillEdge && (
          <text x={W / 2} y={Math.min(H - 6, (sy(elAtOpening(point, 0, o.sill)) + sy(elAtOpening(point, 0, 0))) / 2 + 3)} textAnchor="middle" className="text-[9px] font-semibold" fill={C.halo}>
            {profile.kind === "windowsill" || profile.kind === "indoor" ? "wall below the window" : `${profile.railing} railing`}
          </text>
        )}
        {[-90, -45, 0, 45, 90].map((phi) => (
          <text key={phi} x={Math.min(W - 8, Math.max(8, sx(phi)))} y={H - 4} textAnchor="middle" className="text-[9px] font-bold" fill={C.text} stroke={C.halo} strokeWidth={2.5} paintOrder="stroke">
            {phi === 0 ? `${dirLabel(0)} (straight out)` : dirLabel(phi)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-warm" /> sun reaches this spot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t border-dashed border-ink-2" /> sun hidden by roof, walls or buildings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t border-dotted border-warm" /> path in June / December
        </span>
      </figcaption>
    </figure>
  );
}
