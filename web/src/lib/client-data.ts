import indexJson from "@/data/plants_index.json";
import insightsJson from "@/data/insights.json";
import type { Insight, PlantLite } from "./types";

/** Slim plant index + insights: the only datasets that ship in the browser bundle. */
export const plantIndex = indexJson as unknown as PlantLite[];
export const insights = insightsJson as unknown as Insight[];
