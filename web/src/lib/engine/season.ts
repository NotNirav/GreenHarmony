import { capacityTotal, footprint } from "../space/zones";
import type { City, SpaceProfile, Zone } from "../space/types";
import { evaluate } from "./recommend";
import type { EnginePlant, Placement } from "./types";

export interface SeasonAdvice {
  kind: "move" | "low_sun" | "too_much_sun" | "add";
  plantId: string;
  fromZone?: string;
  toZone?: string;
  text: string;
}

/**
 * Re-checks the garden for the coming weeks: as the sun's path changes through the year,
 * spots get brighter or darker. Suggests moves, flags struggling plants and suggests plants
 * to add to free space this month.
 */
export function seasonCheck(
  placements: Placement[],
  plants: Map<string, EnginePlant>,
  zones: Zone[],
  space: SpaceProfile,
  city: City,
  month = new Date().getMonth() + 1,
): SeasonAdvice[] {
  const advice: SeasonAdvice[] = [];
  const next = (month % 12) + 1;
  const used = new Map<string, number>();
  for (const pl of placements) {
    const z = zones.find((x) => x.id === pl.zoneId);
    const p = plants.get(pl.plantId);
    if (z && p) used.set(z.id, (used.get(z.id) ?? 0) + footprint(z, pl.potL, p.spread_cm));
  }
  const free = (z: Zone, need: number) => (used.get(z.id) ?? 0) + need <= capacityTotal(z) + 1e-6;

  for (const pl of placements) {
    const p = plants.get(pl.plantId);
    const z = zones.find((x) => x.id === pl.zoneId);
    if (!p || !z) continue;
    const now = (z.sunByMonth[month - 1] + z.sunByMonth[next - 1]) / 2;
    const name = p.common_name.split(" (")[0];
    const lacking = now < p.sun_min_hrs - 1;
    const scorched = p.sun_max_hrs <= 4 && now > p.sun_max_hrs + 2;
    if (!lacking && !scorched) continue;

    // Find a better spot that has room and suits the plant.
    const better = zones
      .filter((o) => o.id !== z.id)
      .map((o) => ({ o, e: evaluate(p, o, space, city, month), sun: (o.sunByMonth[month - 1] + o.sunByMonth[next - 1]) / 2 }))
      .filter(({ o, e, sun }) => e.candidate && free(o, footprint(o, pl.potL, p.spread_cm)) && (lacking ? sun > now + 0.8 : sun < now - 0.8))
      .sort((a, b) => (b.e.candidate!.score - a.e.candidate!.score));
    if (better.length) {
      const b = better[0];
      advice.push({
        kind: "move",
        plantId: p.id,
        fromZone: z.id,
        toZone: b.o.id,
        text: `Move ${name} from the ${z.label.toLowerCase()} to the ${b.o.label.toLowerCase()}: ${now.toFixed(1)} h → ${b.sun.toFixed(1)} h of sun over the next few weeks.`,
      });
    } else {
      advice.push({
        kind: lacking ? "low_sun" : "too_much_sun",
        plantId: p.id,
        fromZone: z.id,
        text: lacking
          ? `${name} gets only ~${now.toFixed(1)} h of sun in the ${z.label.toLowerCase()} this season (it likes ${p.sun_min_hrs}+ h). Expect slower growth until the sun returns.`
          : `${name} gets ~${now.toFixed(1)} h of direct sun now; give it afternoon shade.`,
      });
    }
  }

  // Free space + plantable this month → suggest additions.
  const placedIds = new Set(placements.map((pl) => pl.plantId));
  const adds: { p: EnginePlant; z: Zone; score: number }[] = [];
  for (const p of plants.values()) {
    if (placedIds.has(p.id) || !p.plant_months.includes(month)) continue;
    for (const z of zones) {
      const e = evaluate(p, z, space, city, month);
      if (e.candidate && free(z, footprint(z, e.candidate.potL, p.spread_cm))) adds.push({ p, z, score: e.candidate.score });
    }
  }
  adds
    .sort((a, b) => b.score - a.score)
    .filter((x, i, arr) => arr.findIndex((y) => y.p.id === x.p.id) === i)
    .slice(0, 3)
    .forEach(({ p, z }) =>
      advice.push({
        kind: "add",
        plantId: p.id,
        toZone: z.id,
        text: `You have room in the ${z.label.toLowerCase()}, and this is a good month to plant ${p.common_name.split(" (")[0]}.`,
      }),
    );
  return advice;
}
