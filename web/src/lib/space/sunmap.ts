import { SAMPLE_HOURS, SAMPLE_STEP_H, angleDiff, sunPosition } from "./solar";
import type { City, FrontHeight, FrontView, Point3, SpaceProfile } from "./types";

const RAD = Math.PI / 180;

/** Horizontal distance (m) to the nearest building in front for each answer. */
export const FRONT_DISTANCE: Record<FrontView, number> = { open: Infinity, far: 45, medium: 22, near: 9 };
/** That building's roofline relative to your floor level (m). */
export const FRONT_RISE: Record<FrontHeight, number> = { lower: -2, similar: 4, taller: 14, much_taller: 32 };

/** How much light passes a railing the sun shines through. */
const RAILING_TRANSMIT = { solid: 0, grill: 0.6, glass: 0.85, none: 1 } as const;

/** Opening geometry the light has to pass through, derived from the profile. */
export interface Opening {
  width: number;
  ceiling: number | null;
  sill: number;
  sillTransmit: number;
  sides: SpaceProfile["sides"];
  facing: number;
  open360: boolean;
}

export function openingFor(p: SpaceProfile): Opening {
  if (p.kind === "windowsill" || p.kind === "indoor") {
    // A window: wall below the sill (0.9 m), lintel above (2.1 m), jambs on both sides.
    return { width: p.width, ceiling: 2.1, sill: 0.9, sillTransmit: 0, sides: "both", facing: p.facing, open360: false };
  }
  if (p.kind === "terrace") {
    return { width: p.width, ceiling: p.ceiling, sill: p.railingHeight, sillTransmit: RAILING_TRANSMIT[p.railing], sides: "none", facing: p.facing, open360: p.ceiling === null };
  }
  return {
    width: p.width,
    ceiling: p.ceiling,
    sill: p.railing === "none" ? 0 : p.railingHeight,
    sillTransmit: RAILING_TRANSMIT[p.railing],
    sides: p.sides,
    facing: p.facing,
    open360: false,
  };
}

/**
 * Fraction (0–1) of direct sun reaching a point for one sun position. Traces the ray from the
 * point towards the sun through the opening plane and tests ceiling, railing/sill, side walls,
 * the skyline of the building in front and trees.
 */
export function lightAt(p: SpaceProfile, o: Opening, pt: Point3, alt: number, az: number): number {
  if (alt <= 0.5) return 0;
  const phi = angleDiff(az, o.facing);
  const tanAlt = Math.tan(alt * RAD);
  let weight = 1;

  if (o.open360) {
    // Open terrace: low sun can still be cut by the parapet for pots right next to it.
    if (pt.z < o.sill && alt < 25 && pt.x < 0.6) weight *= o.sillTransmit || 0.4;
  } else {
    if (Math.abs(phi) >= 89) return 0; // sun is behind the building wall
    const cosPhi = Math.cos(phi * RAD);
    const run = pt.x / cosPhi; // horizontal distance travelled to reach the opening plane
    const hPlane = pt.z + run * tanAlt;
    if (o.ceiling !== null && hPlane > o.ceiling) return 0;
    const yPlane = pt.y + pt.x * Math.tan(phi * RAD);
    if (o.sides === "both" && (yPlane < 0 || yPlane > o.width)) return 0;
    if (o.sides === "one" && yPlane < 0) return 0;
    if (hPlane < o.sill) {
      if (o.sillTransmit === 0) return 0;
      weight *= o.sillTransmit;
    }
  }

  // Skyline of the building in front (spans roughly ±70° of the facing direction).
  const dist = FRONT_DISTANCE[p.frontView];
  if (Number.isFinite(dist) && Math.abs(phi) < 70) {
    const rise = FRONT_RISE[p.frontHeight] - pt.z;
    if (rise > 0) {
      const skyline = Math.atan2(rise, dist / Math.max(0.35, Math.cos(phi * RAD))) / RAD;
      if (alt < skyline) return 0;
    }
  }
  if (p.trees && alt < 30) weight *= 0.5;
  return weight;
}

/** Direct-sun hours at the given points (averaged) on the 15th of a month. */
export function sunHours(p: SpaceProfile, city: Pick<City, "lat" | "lon">, points: Point3[], month: number): number {
  const o = openingFor(p);
  let total = 0;
  for (const h of SAMPLE_HOURS) {
    const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, h);
    if (altitude <= 0) continue;
    let w = 0;
    for (const pt of points) w += lightAt(p, o, pt, altitude, azimuth);
    total += (w / points.length) * SAMPLE_STEP_H;
  }
  return Math.round(total * 10) / 10;
}

/** 12 monthly values of direct-sun hours. */
export function sunByMonth(p: SpaceProfile, city: Pick<City, "lat" | "lon">, points: Point3[]): number[] {
  return Array.from({ length: 12 }, (_, i) => sunHours(p, city, points, i + 1));
}

export interface FloorGrid {
  cols: number;
  rows: number;
  /** Cell size in metres. */
  cell: number;
  /** hours[row][col]; row 0 is at the opening/railing. */
  hours: number[][];
}

/** Top-down heatmap of direct-sun hours across the floor (at pot height) for one month. */
export function floorGrid(p: SpaceProfile, city: Pick<City, "lat" | "lon">, month: number, maxCells = 18): FloorGrid {
  const longest = Math.max(p.width, p.depth);
  const cell = Math.max(0.1, longest / maxCells);
  const cols = Math.max(1, Math.round(p.width / cell));
  const rows = Math.max(1, Math.round(p.depth / cell));
  const o = openingFor(p);
  const hours = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);
  const z = p.kind === "windowsill" ? 0.95 : p.kind === "indoor" ? 0.8 : 0.3;
  for (const h of SAMPLE_HOURS) {
    const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, h);
    if (altitude <= 0) continue;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = { x: (r + 0.5) * cell, y: (c + 0.5) * cell, z };
        hours[r][c] += lightAt(p, o, pt, altitude, azimuth) * SAMPLE_STEP_H;
      }
    }
  }
  return { cols, rows, cell, hours: hours.map((row) => row.map((v) => Math.round(v * 10) / 10)) };
}

/** Fraction of direct sun on each floor cell at one moment (for the "through the day" view). */
export function floorAt(p: SpaceProfile, city: Pick<City, "lat" | "lon">, month: number, hour: number, cols: number, rows: number): number[][] {
  const o = openingFor(p);
  const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, hour);
  const z = p.kind === "windowsill" ? 0.95 : p.kind === "indoor" ? 0.8 : 0.3;
  const cw = p.width / cols;
  const rd = p.depth / rows;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (altitude <= 0 ? 0 : lightAt(p, o, { x: (r + 0.5) * rd, y: (c + 0.5) * cw, z }, altitude, azimuth))),
  );
}

/** Light (0–1) at the given points for every 15-minute sample of the day. */
export function dayTimeline(p: SpaceProfile, city: Pick<City, "lat" | "lon">, points: Point3[], month: number): { hour: number; light: number }[] {
  const o = openingFor(p);
  return SAMPLE_HOURS.map((hour) => {
    const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, hour);
    if (altitude <= 0) return { hour, light: 0 };
    const w = points.reduce((a, pt) => a + lightAt(p, o, pt, altitude, azimuth), 0) / points.length;
    return { hour, light: w };
  });
}

/** Where the sun is relative to the space at one moment, in words the UI can show. */
export function sunSituation(p: SpaceProfile, city: Pick<City, "lat" | "lon">, month: number, hour: number) {
  const { altitude, azimuth } = sunPosition(city.lat, city.lon, month, 15, hour);
  const phi = angleDiff(azimuth, p.facing);
  // Angle of the sun in the vertical plane straight out from the opening (what decides how deep it reaches).
  const profileAngle = Math.abs(phi) < 89 ? Math.atan(Math.tan(altitude * RAD) / Math.cos(phi * RAD)) / RAD : null;
  const state: "night" | "behind" | "in_front" = altitude <= 0 ? "night" : p.kind !== "terrace" && Math.abs(phi) >= 89 ? "behind" : "in_front";
  return { altitude, azimuth, phi, profileAngle, state };
}
