import type { Category, Level } from "../types";
import type { Zone, ZoneKind } from "../space/types";

/** Plant fields the planner needs (data-pipeline ENGINE_FIELDS → plants_engine.json). */
export interface EnginePlant {
  id: string;
  slug: string;
  common_name: string;
  hindi_name: string;
  marathi_name: string;
  search_terms: string[];
  search_keys: string[];
  botanical_name: string;
  category: Category;
  availability: "everywhere" | "common" | "specialty";
  popularity: number;
  price_inr_min: number;
  price_inr_max: number;
  sun_min_hrs: number;
  sun_max_hrs: number;
  water: Level;
  water_l_per_week: number;
  drought_tolerance: Level;
  temp_min_c: number;
  temp_max_c: number;
  humidity: Level | "any";
  min_pot_l: number;
  pot_depth_cm: number;
  height_cm: number;
  spread_cm: number;
  habit: string;
  zones: string[];
  benefits: string[];
  edible: boolean;
  pollinator: number;
  maintenance: number;
  beginner_score: number;
  growth_rate: "slow" | "medium" | "fast";
  lifecycle: "annual" | "biennial" | "perennial";
  propagation: string[];
  plant_months: number[];
  peak_months: number[];
  days_to_harvest: number;
  pet_safe: "yes" | "no" | "unknown";
  care_tip: string;
  photo: { url: string; thumb_url: string } | null;
}

export type ExcludeReason = "less_sun" | "too_much_sun" | "heat" | "cold" | "water" | "no_spot" | "pets" | "budget";

/** Points earned per weight (see weights.ts), plus microclimate penalties. */
export type Breakdown = Partial<Record<import("./weights").WeightKey | "penalty", number>>;

export interface Candidate {
  plant: EnginePlant;
  zone: Zone;
  score: number;
  sunFit: number;
  waterFit: number;
  /** Average direct-sun hours in this zone over the coming growing months. */
  sun: number;
  potL: number;
  reasons: string[];
  warnings: string[];
  breakdown: Breakdown;
  /** Only feasible under relaxed tolerances (harsh climate / dark spot fallback). */
  relaxed?: boolean;
}

export interface Placement {
  plantId: string;
  zoneId: ZoneKind;
  potL: number;
  score: number;
  reasons: string[];
  warnings: string[];
  /** Next-best plants for the same spot (used by "Swap"). */
  alternatives: string[];
  /** User says it is already in the ground / pot. */
  planted: boolean;
  owned: boolean;
  /** Chosen by the user (swap / move / add): kept on re-plan. */
  pinned?: boolean;
  breakdown?: Breakdown;
}

export interface Plan {
  createdAt: string;
  month: number;
  placements: Placement[];
  excluded: { reason: ExcludeReason; count: number }[];
  capacity: { zoneId: ZoneKind; used: number; total: number }[];
  /** True when strict rules left too few plants and the fallback was used. */
  relaxed?: boolean;
}
