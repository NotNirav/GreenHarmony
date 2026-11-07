import citiesJson from "@/data/cities.json";
import plantsJson from "@/data/plants_engine.json";
import type { City } from "../space/types";
import type { EnginePlant } from "./types";

/** Planner datasets. Only the /plan and /garden routes import this module. */
export const enginePlants = plantsJson as unknown as EnginePlant[];
export const enginePlantMap = new Map(enginePlants.map((p) => [p.id, p]));
export const cities = (citiesJson as unknown as City[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const cityMap = new Map(cities.map((c) => [c.id, c]));

/** Nearest city in our list to a coordinate (for "use my location"). */
export function nearestCity(lat: number, lon: number): City {
  let best = cities[0];
  let bestD = Infinity;
  for (const c of cities) {
    const d = (c.lat - lat) ** 2 + ((c.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
