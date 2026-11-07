import plantsJson from "@/data/plants.json";
import insightsJson from "@/data/insights.json";
import statsJson from "@/data/stats.json";
import type { Insight, Plant, PlantLite, Stats } from "./types";

// Server-only full dataset. Client components must import from "./client-data" instead.

export const plants = plantsJson as unknown as Plant[];
export const insights = insightsJson as unknown as Insight[];
export const stats = statsJson as unknown as Stats;

const bySlug = new Map(plants.map((p) => [p.slug, p]));
const byId = new Map(plants.map((p) => [p.id, p]));

export function getPlantBySlug(slug: string): Plant | undefined {
  return bySlug.get(slug);
}

export function getPlantById(id: string): Plant | undefined {
  return byId.get(id);
}

export function insightsForPlant(id: string): Insight[] {
  return insights.filter((i) => i.plant_ids.includes(id));
}

/** Plants that share zones and sun needs — simple companions until the Phase 2 engine exists. */
export function similarPlants(plant: Plant, limit = 6): Plant[] {
  return plants
    .filter((p) => p.id !== plant.id)
    .map((p) => {
      let score = 0;
      if (p.category === plant.category) score += 2;
      if (p.sun_class === plant.sun_class) score += 2;
      if (p.water === plant.water) score += 1;
      score += p.zones.filter((z) => plant.zones.includes(z)).length * 0.5;
      score += p.popularity * 0.3;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Only the fields cards need, so pages don't serialize whole plant records. */
export function lite(p: Plant): PlantLite {
  const { photo, ...rest } = p;
  return { ...rest, photo: photo ? { url: photo.url, thumb_url: photo.thumb_url } : null } as PlantLite;
}
