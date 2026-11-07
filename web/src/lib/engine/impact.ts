import { capacityTotal, footprint } from "../space/zones";
import type { SpaceProfile, Zone } from "../space/types";
import type { EnginePlant, Placement } from "./types";

export interface Impact {
  greenAreaM2: number;
  coveragePct: number;
  waterLPerWeek: number;
  baselineWaterLPerWeek: number;
  waterSavedPct: number;
  pollinatorPct: number;
  co2KgPerYear: [number, number];
  edibleCount: number;
  harmony: { total: number; parts: { key: string; label: string; value: number }[] };
}

/**
 * Model-based estimates for the plan (labelled as such in the UI). Green area counts plant
 * canopy plus vertical green from climbers.
 */
export function impactFor(
  placements: Placement[],
  plants: Map<string, EnginePlant>,
  zones: Zone[],
  space: SpaceProfile,
  allPlants: EnginePlant[],
  sunFits: number[],
): Impact {
  const ps = placements.map((pl) => ({ pl, p: plants.get(pl.plantId) })).filter((x): x is { pl: Placement; p: EnginePlant } => !!x.p);
  const n = Math.max(1, ps.length);

  // Conservative: pots keep plants small (canopy capped at 60 cm across), a climber greens at
  // most ~1.8 m² of wall, and the total can't exceed the space's own floor + wall area.
  let green = 0;
  for (const { pl, p } of ps) {
    if (pl.zoneId === "climber") green += Math.min(1.8, 0.9 * Math.min(2, p.height_cm / 100));
    else green += Math.PI * Math.pow(Math.min(p.spread_cm, 60) / 200, 2);
  }
  const floorArea = space.kind === "windowsill" ? space.width * 0.25 : space.width * space.depth;
  const wallArea = space.kind === "windowsill" ? 0 : space.width * Math.min(2, space.ceiling ?? 2);
  green = Math.min(green, floorArea + wallArea);

  const water = ps.reduce((a, { p }) => a + p.water_l_per_week, 0);
  const thirsty = allPlants.filter((p) => p.water === "high");
  const baselineEach = thirsty.reduce((a, p) => a + p.water_l_per_week, 0) / Math.max(1, thirsty.length);
  const baseline = Math.max(water, baselineEach * ps.length);

  const pollinator = ps.reduce((a, { p }) => a + p.pollinator, 0) / (3 * n);
  const cats = new Set(ps.map(({ p }) => p.category)).size;
  const habits = new Set(ps.map(({ p }) => p.habit)).size;
  const flowers = ps.filter(({ p }) => p.benefits.includes("flowers")).length;

  const used = new Map<string, number>();
  for (const { pl, p } of ps) {
    const z = zones.find((x) => x.id === pl.zoneId);
    if (z) used.set(z.id, (used.get(z.id) ?? 0) + footprint(z, pl.potL, p.spread_cm));
  }
  const spaceUse = zones.length
    ? zones.reduce((a, z) => a + Math.min(1, (used.get(z.id) ?? 0) / Math.max(0.01, capacityTotal(z))), 0) / zones.length
    : 0;

  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100);
  const parts = [
    { key: "diversity", label: "Diversity", value: clamp(Math.min(1, cats / 4) * 0.6 + Math.min(1, habits / 4) * 0.4) },
    { key: "sun", label: "Sun fit", value: clamp(sunFits.length ? sunFits.reduce((a, b) => a + b, 0) / sunFits.length : 0) },
    { key: "water", label: "Water efficiency", value: clamp(baseline > 0 ? 1 - water / baseline + 0.3 : 0) },
    { key: "bio", label: "Biodiversity", value: clamp(pollinator * 0.75 + (flowers >= 2 ? 0.25 : flowers * 0.12)) },
    { key: "space", label: "Space use", value: clamp(spaceUse * 1.15) },
    {
      key: "sustain",
      label: "Sustainability",
      value: clamp(
        (ps.filter(({ p }) => p.lifecycle === "perennial").length / n) * 0.4 +
          (ps.filter(({ p }) => p.water !== "high").length / n) * 0.35 +
          (ps.filter(({ p }) => p.edible).length / n) * 0.25 +
          0.1,
      ),
    },
  ];
  const total = Math.round(parts.reduce((a, x) => a + x.value, 0) / parts.length);

  return {
    greenAreaM2: Math.round(green * 10) / 10,
    coveragePct: Math.round(Math.min(1, green / Math.max(0.1, floorArea)) * 100),
    waterLPerWeek: Math.round(water * 10) / 10,
    baselineWaterLPerWeek: Math.round(baseline * 10) / 10,
    waterSavedPct: baseline > 0 ? Math.round((1 - water / baseline) * 100) : 0,
    pollinatorPct: Math.round(pollinator * 100),
    // Rough: small potted plants fix ~0.5–2 kg CO₂ per m² of canopy per year.
    co2KgPerYear: [Math.round(green * 0.5 * 10) / 10, Math.round(green * 2 * 10) / 10],
    edibleCount: ps.filter(({ p }) => p.edible).length,
    harmony: { total, parts },
  };
}
