import { sunByMonth, sunHours } from "./sunmap";
import type { City, Point3, SpaceProfile, Zone, ZoneKind } from "./types";

/** Pot diameter (cm) for a pot of `litres`, assuming a pot about as tall as it is wide. */
export function potDiameterCm(litres: number): number {
  return Math.cbrt((Math.max(0.5, litres) * 1000) / 0.707);
}

/** Standard nursery pot sizes (litres); plans round up to these. */
export const POT_SIZES = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 60, 80];
export function standardPot(litres: number): number {
  return POT_SIZES.find((s) => s >= litres) ?? POT_SIZES[POT_SIZES.length - 1];
}

/** Points spread along the width at a given depth and height (used to average the light). */
function row(p: SpaceProfile, x: number, z: number): Point3[] {
  return [0.15, 0.5, 0.85].map((f) => ({ x, y: p.width * f, z }));
}

function windLevel(p: SpaceProfile): 0 | 1 | 2 {
  let w = p.floor >= 15 ? 2 : p.floor >= 8 ? 1 : 0;
  if (p.kind === "terrace") w += 1;
  return Math.min(2, w) as 0 | 1 | 2;
}

function westish(p: SpaceProfile): boolean {
  return p.facing === 225 || p.facing === 270 || p.facing === 315 || p.kind === "terrace";
}

/** Floor area left for pots after walkway and seating, split into a front band and a back band. */
function floorBands(p: SpaceProfile): { front: number; back: number; frontDepth: number; backStart: number } {
  if (p.kind === "terrace") {
    const area = p.width * p.depth * (p.walkway ? 0.6 : 0.8) - p.seating * 0.7;
    return { front: Math.max(0, area), back: 0, frontDepth: Math.min(1, p.depth / 2), backStart: 0 };
  }
  const walk = p.walkway ? 0.55 : 0;
  const usable = Math.max(0, p.depth - walk);
  const frontDepth = Math.min(0.6, usable);
  const seat = p.seating === 0 ? 0 : p.seating === 1 ? 0.5 : 1.1;
  const backDepth = Math.max(0, usable - frontDepth);
  const back = Math.max(0, p.width * backDepth - seat);
  const front = Math.max(0, p.width * frontDepth - (backDepth > 0 ? 0 : seat));
  return { front, back, frontDepth, backStart: frontDepth + walk };
}

const LABELS: Record<ZoneKind, [string, string]> = {
  railing: ["Railing planters", "Along the balcony edge"],
  floor_front: ["Front floor", "Pots just behind the railing"],
  floor_back: ["Back floor", "Pots near the wall"],
  climber: ["Grill / wall", "Climbers trained upwards"],
  hanging: ["Hanging baskets", "From ceiling hooks"],
  shelf: ["Shelf / rack", "Tiered stand"],
  windowsill: ["Windowsill", "Small pots on the sill"],
  indoor: ["Indoor spot", "Inside, near the window"],
};

function zone(kind: ZoneKind, partial: Omit<Zone, "id" | "kind" | "label" | "hint" | "sunByMonth">, p: SpaceProfile, city: City): Zone {
  const [label, hint] = LABELS[kind];
  const raw = sunByMonth(p, city, partial.points);
  return { id: kind, kind, label, hint, sunByMonth: calibrate(raw, p, city), ...partial };
}

/**
 * If the user told us how much sun they really see on the floor this month, scale the
 * modelled hours to match (bounded, so one rough guess can't break the model).
 */
function calibrate(hours: number[], p: SpaceProfile, city: City): number[] {
  if (p.sunCalibration == null) return hours;
  const month = new Date().getMonth() + 1;
  const ref = referencePoints(p);
  const modelled = sunHours(p, city, ref, month);
  const ratio = modelled > 0.3 ? Math.min(2.5, Math.max(0.3, p.sunCalibration / modelled)) : 1;
  return hours.map((h) => Math.min(12, Math.round(h * ratio * 10) / 10));
}

/** Where we assume the user looked when calibrating: the main floor area. */
function referencePoints(p: SpaceProfile): Point3[] {
  if (p.kind === "windowsill") return row(p, 0.1, 0.95);
  if (p.kind === "indoor") return row(p, Math.max(0.5, p.depth), 0.8);
  return row(p, Math.min(0.5, p.depth / 2), 0.25);
}

/** Turn a space profile into concrete growing zones with sun, exposure and capacity. */
export function buildZones(p: SpaceProfile, city: City): Zone[] {
  const wind = windLevel(p);
  const covered = p.ceiling !== null;
  const zones: Zone[] = [];

  if (p.kind === "windowsill") {
    zones.push(
      zone("windowsill", {
        dataZone: "windowsill",
        points: row(p, 0.1, 0.95),
        capacity: { type: "length", m: p.width },
        maxPotL: 3,
        maxHeightCm: 60,
        rain: false,
        wind: 0,
        heat: false,
      }, p, city),
    );
    return zones;
  }

  if (p.kind === "indoor") {
    zones.push(
      zone("indoor", {
        dataZone: "indoor",
        points: row(p, Math.max(0.5, p.depth), 0.8),
        capacity: { type: "area", m2: Math.max(0.4, p.width * 0.6) },
        maxPotL: 30,
        maxHeightCm: 220,
        rain: false,
        wind: 0,
        heat: false,
      }, p, city),
    );
    return zones;
  }

  const bands = floorBands(p);
  const heat = westish(p) && !covered;

  if (p.railing === "grill" || p.railing === "solid") {
    zones.push(
      zone("railing", {
        dataZone: "railing",
        // Foliage sits above the planter, so sample just over the railing top.
        points: row(p, 0.08, p.railingHeight + 0.15),
        capacity: { type: "length", m: p.width },
        maxPotL: p.railing === "solid" ? 10 : 8,
        maxHeightCm: 120,
        rain: true,
        wind,
        heat: westish(p),
      }, p, city),
    );
  }

  if (bands.front > 0.05) {
    zones.push(
      zone("floor_front", {
        dataZone: "floor",
        points: row(p, Math.max(0.2, bands.frontDepth / 2), 0.3),
        capacity: { type: "area", m2: bands.front },
        maxPotL: 80,
        maxHeightCm: covered ? Math.round((p.ceiling ?? 3) * 90) : 400,
        rain: !covered || p.depth <= 1,
        wind,
        heat,
      }, p, city),
    );
  }

  if (bands.back > 0.15) {
    const x = Math.min(p.depth - 0.25, bands.backStart + 0.3);
    zones.push(
      zone("floor_back", {
        dataZone: "floor",
        points: row(p, x, 0.3),
        capacity: { type: "area", m2: bands.back },
        maxPotL: 80,
        maxHeightCm: covered ? Math.round((p.ceiling ?? 3) * 90) : 400,
        rain: !covered,
        wind: Math.max(0, wind - 1) as 0 | 1 | 2,
        heat: false,
      }, p, city),
    );
  }

  if (p.climberSupport) {
    // Climbers go up the grill if there is one, otherwise up the back wall.
    const onGrill = p.railing === "grill" || p.kind === "terrace";
    const x = onGrill ? 0.1 : Math.max(0.2, p.depth - 0.1);
    zones.push(
      zone("climber", {
        dataZone: "wall",
        points: [0.8, 1.4, 2].map((z) => ({ x, y: p.width / 2, z })),
        capacity: { type: "count", n: Math.max(1, Math.floor(p.width / 0.9)) },
        maxPotL: 40,
        maxHeightCm: 1000,
        rain: onGrill || !covered,
        wind,
        heat: westish(p),
      }, p, city),
    );
  }

  if (p.hooks > 0) {
    const z = covered ? Math.max(1.6, (p.ceiling ?? 2.8) - 0.6) : 2;
    zones.push(
      zone("hanging", {
        dataZone: "hanging",
        points: row(p, 0.35, z),
        capacity: { type: "count", n: p.hooks },
        maxPotL: 5,
        maxHeightCm: 80,
        rain: !covered,
        wind: Math.min(2, wind + 1) as 0 | 1 | 2,
        heat: westish(p),
      }, p, city),
    );
  }

  if (p.shelf) {
    zones.push(
      zone("shelf", {
        dataZone: "rack",
        points: [{ x: Math.max(0.3, p.depth * 0.6), y: 0.15, z: 0.9 }],
        capacity: { type: "count", n: 4 },
        maxPotL: 5,
        maxHeightCm: 60,
        rain: !covered,
        wind,
        heat: false,
      }, p, city),
    );
  }

  return zones;
}

/** How many slots / how much room a plant in a pot of `potL` takes in a zone. */
export function footprint(zone: Zone, potL: number, spreadCm: number): number {
  const d = potDiameterCm(potL);
  switch (zone.capacity.type) {
    case "area": {
      const s = Math.max(d, Math.min(spreadCm, d * 1.7)) / 100;
      return s * s * 0.85;
    }
    case "length":
      return Math.max(d, 18) / 100;
    case "count":
      return 1;
  }
}

export function capacityTotal(zone: Zone): number {
  return zone.capacity.type === "area" ? zone.capacity.m2 : zone.capacity.type === "length" ? zone.capacity.m : zone.capacity.n;
}
