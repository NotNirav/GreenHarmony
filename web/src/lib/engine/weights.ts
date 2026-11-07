/**
 * How much each part of the user's answers counts. One place, so the UI can show it and the
 * tests can check it. Scores are out of 100.
 *
 * Hard rules are not points: a plant that breaks one is excluded from that spot (with a reason).
 */
export type Tier = "major" | "medium" | "minor";

export interface Weight {
  key: WeightKey;
  pts: number;
  tier: Tier;
  label: string;
  from: string;
}

export type WeightKey = "sun" | "goals" | "climate" | "water" | "buyable" | "experience" | "season" | "fun";

export const WEIGHTS: Record<WeightKey, Weight> = {
  sun: { key: "sun", pts: 25, tier: "major", label: "Sun fit", from: "Your balcony's shape, direction, roof, railing and surroundings" },
  goals: { key: "goals", pts: 25, tier: "major", label: "Your goals", from: "What you want from the garden" },
  climate: { key: "climate", pts: 12, tier: "major", label: "Climate margin", from: "Your city's summer and winter" },
  water: { key: "water", pts: 8, tier: "major", label: "Water fit", from: "How often you can water, and travel" },
  buyable: { key: "buyable", pts: 10, tier: "medium", label: "Easy to buy", from: "Sold at local nurseries, popular in India" },
  experience: { key: "experience", pts: 7, tier: "medium", label: "Matches your experience", from: "How much you've grown before" },
  season: { key: "season", pts: 5, tier: "medium", label: "Plant it now", from: "This month's planting season" },
  fun: { key: "fun", pts: 8, tier: "minor", label: "Your style", from: "When you enjoy the balcony and who gardens with you" },
};

export const HARD_RULES = [
  "Too little sun this month or over the season (more than 2 h / 1 h short)",
  "Too hot or too cold for your city in the months it grows",
  "Needs watering more often than you can",
  "Doesn't fit the spot (pot size, height, climber needs a grill)",
  "Toxic, when you have pets or small children",
  "Over your budget",
];

/** Tolerances (hours / °C). The relaxed set is only used when strict rules leave almost nothing. */
export const TOLERANCE = {
  strict: { sunNow: 2, sunSeason: 1, heat: 1, cold: 1 },
  relaxed: { sunNow: 3, sunSeason: 1.5, heat: 3, cold: 6 },
} as const;

/** Night-fragrant plants for people who enjoy the balcony in the evening. */
export const NIGHT_FRAGRANT = new Set(["raat_ki_rani", "mogra", "juhi", "chameli", "parijat", "tuberose", "kamini", "madhumalti", "kunda", "plumeria", "tagar"]);
/** Morning show-offs: open in the morning or bring morning birds and butterflies. */
export const MORNING_BLOOMS = new Set(["portulaca", "hibiscus", "morning_glory", "periwinkle", "aparajita", "pentas", "ixora", "zinnia", "cosmos", "sunflower"]);
/** Kid-friendly: fast, fun, touchable, safe. */
export const KID_FAVOURITES = new Set(["sunflower", "cherry_tomato", "balsam", "microgreens", "wheatgrass", "marigold", "strawberry", "mint", "spider_plant", "zinnia", "radish", "peas"]);
