/**
 * Solar position (NOAA General Solar Position equations). Accurate to well under a degree,
 * which is plenty for working out which part of a balcony the sun reaches.
 */

const RAD = Math.PI / 180;
export const IST_OFFSET_H = 5.5;

export interface SunPos {
  /** Degrees above the horizon (negative = below). */
  altitude: number;
  /** Degrees clockwise from north. */
  azimuth: number;
}

function dayOfYear(month: number, day: number): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return cum[month - 1] + day;
}

/** Sun position for a latitude/longitude, a calendar day and a local IST clock time (decimal hours). */
export function sunPosition(lat: number, lon: number, month: number, day: number, hourIST: number): SunPos {
  const n = dayOfYear(month, day);
  const g = ((2 * Math.PI) / 365) * (n - 1 + (hourIST - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const trueSolarMin = hourIST * 60 + eqTime + 4 * lon - 60 * IST_OFFSET_H;
  const ha = (trueSolarMin / 4 - 180) * RAD;
  const phi = lat * RAD;

  const cosZen = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  // Azimuth measured from south, westward positive; +180 converts to "from north, clockwise".
  const azFromSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  const azimuth = (azFromSouth / RAD + 180 + 360) % 360;
  return { altitude: 90 - zen / RAD, azimuth };
}

/** Signed smallest difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export const SAMPLE_STEP_H = 0.25;
/** 06:00 → 18:45 IST in 15-minute steps; covers daylight everywhere in India. */
export const SAMPLE_HOURS = Array.from({ length: 52 }, (_, i) => 6 + i * SAMPLE_STEP_H);
