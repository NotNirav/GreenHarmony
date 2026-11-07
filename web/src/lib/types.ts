export type Category =
  | "herb"
  | "vegetable"
  | "fruit"
  | "flowering"
  | "foliage"
  | "succulent"
  | "climber"
  | "medicinal";

export type Zone = "floor" | "railing" | "wall" | "hanging" | "rack" | "windowsill" | "indoor";
export type Level = "low" | "medium" | "high";
export type SunClass = "full_sun" | "partial_sun" | "shade";
export type Availability = "everywhere" | "common" | "specialty";

export interface PlantPhoto {
  url: string;
  large_url: string;
  thumb_url: string;
  attribution: string | null;
  license: string;
  license_url: string | null;
  commercial_ok: boolean;
  source: string;
  source_url: string;
}

export interface Plant {
  id: string;
  slug: string;
  common_name: string;
  hindi_name: string;
  marathi_name: string;
  botanical_name: string;
  category: Category;
  availability: Availability;
  popularity: number;
  price_inr_min: number;
  price_inr_max: number;
  why_popular: string;
  sun_min_hrs: number;
  sun_max_hrs: number;
  sun_class: SunClass;
  water: Level;
  water_l_per_week: number;
  drought_tolerance: Level;
  temp_min_c: number;
  temp_max_c: number;
  humidity: Level | "any";
  min_pot_l: number;
  pot_size_class: "small" | "medium" | "large" | "xl";
  pot_depth_cm: number;
  height_cm: number;
  spread_cm: number;
  habit: string;
  zones: Zone[];
  space_fit: Zone[];
  indoor_ok: boolean;
  benefits: string[];
  edible: boolean;
  pollinator: number;
  maintenance: number;
  beginner_score: number;
  beginner_friendly: boolean;
  growth_rate: "slow" | "medium" | "fast";
  lifecycle: "annual" | "biennial" | "perennial";
  propagation: string[];
  plant_months: number[];
  peak_months: number[];
  days_to_harvest: number;
  pet_safe: "yes" | "no" | "unknown";
  care_tip: string;
  /** Local nicknames people search with, e.g. Prajakta for parijat. */
  other_names: string[];
  /** "plant" = small plant in a grow bag; "seedling" = seed-grown crop bought as a seedling. */
  price_basis: "plant" | "seedling";
  /** Real prices seen in stores (sources/price_checks.csv). */
  price_checks: { channel: "online" | "local" | "wholesale"; price_inr: number; source: string; checked: string }[];
  taxonomy: {
    gbif_key: number;
    accepted_name: string;
    family: string;
    genus: string;
    status: string;
    match_type: string;
    confidence: number;
  } | null;
  traits_openplantdb: {
    cultivars_known: number;
    germination_days: number | null;
    maturity_days: number | null;
    spacing_cm: number | null;
    height_cm: number | null;
  } | null;
  photo: PlantPhoto | null;
  links: { inaturalist?: string; wikipedia?: string | null };
  inat_observations: number | null;
  search_terms: string[];
  /** Consonant skeletons of every name, for Roman-script phonetic search. */
  search_keys: string[];
}

/** Slim record shipped to the browser (data-pipeline INDEX_FIELDS). */
export type PlantLite = Pick<
  Plant,
  | "id" | "slug" | "common_name" | "hindi_name" | "marathi_name" | "botanical_name" | "category" | "availability"
  | "popularity" | "price_inr_min" | "price_inr_max" | "sun_class" | "water" | "zones" | "benefits" | "edible"
  | "pollinator" | "beginner_score" | "beginner_friendly" | "pet_safe" | "plant_months" | "price_basis" | "search_terms" | "search_keys"
> & { photo: { url: string; thumb_url: string } | null };

export type InsightContext = "loading" | "transition" | "empty" | "tip";

export interface Insight {
  id: string;
  category: string;
  contexts: InsightContext[];
  months: number[];
  plant_ids: string[];
  plant_links: { slug: string; name: string }[];
  text: string;
}

export interface Stats {
  generated: string;
  plants: number;
  insights: number;
  by_category: Record<string, number>;
  by_availability: Record<string, number>;
  beginner_friendly: number;
  edible: number;
  with_photo: number;
  with_gbif: number;
  with_openplantdb: number;
  families: number;
}
