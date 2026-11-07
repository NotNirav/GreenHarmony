/** Compass bearing the space opens towards (N = 0, E = 90, S = 180, W = 270). */
export type Facing = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
export type SpaceKind = "balcony" | "terrace" | "windowsill" | "indoor";
export type RailingType = "grill" | "solid" | "glass" | "none";
export type SideWalls = "none" | "one" | "both";
/** Distance to the nearest building in front: open view, >40 m, 15–40 m, <15 m. */
export type FrontView = "open" | "far" | "medium" | "near";
/** Height of that building relative to your floor. */
export type FrontHeight = "lower" | "similar" | "taller" | "much_taller";
export type WaterHabit = "daily" | "alternate" | "weekly";
export type Experience = "new" | "some" | "pro";
export type EnjoyTime = "morning" | "evening" | "anytime";
export type Companions = "solo" | "family" | "kids";
export type Goal = "food" | "fragrance" | "flowers" | "sacred" | "pollinator" | "medicinal" | "privacy" | "low_effort";

/** Everything we know about the user's real space. Every field has a sensible default. */
export interface SpaceProfile {
  v: 1;
  cityId: string;
  kind: SpaceKind;
  /** Metres along the opening (railing length / window width). */
  width: number;
  /** Metres from the opening inwards (for "indoor": distance of the plant spot from the window). */
  depth: number;
  /** Ceiling / roof height above the floor in metres; null = open sky. */
  ceiling: number | null;
  facing: Facing;
  /** Storey, 0 = ground floor. */
  floor: number;
  railing: RailingType;
  railingHeight: number;
  sides: SideWalls;
  frontView: FrontView;
  frontHeight: FrontHeight;
  trees: boolean;
  climberSupport: boolean;
  hooks: number;
  shelf: boolean;
  walkway: boolean;
  seating: 0 | 1 | 2;
  water: WaterHabit;
  travels: boolean;
  experience: Experience;
  goals: Goal[];
  /** Pets or small children at home: exclude toxic plants. */
  pets: boolean;
  budget: number | null;
  /** Optional calibration: hours of direct sun the user actually sees on the floor this month. */
  sunCalibration: number | null;
  /** Plant ids the user already owns; the plan is built around them. */
  owned: string[];
  /** Fun, low-weight questions. */
  gardenName: string;
  enjoy: EnjoyTime;
  companions: Companions;
}

export type ZoneKind = "railing" | "floor_front" | "floor_back" | "climber" | "hanging" | "shelf" | "windowsill" | "indoor";
/** Placement vocabulary used in the plant dataset's `zones` column. */
export type DataZone = "floor" | "railing" | "wall" | "hanging" | "rack" | "windowsill" | "indoor";

export interface Point3 {
  /** Metres inwards from the opening plane. */
  x: number;
  /** Metres to the right, looking out. */
  y: number;
  /** Metres above the floor. */
  z: number;
}

export type Capacity = { type: "area"; m2: number } | { type: "length"; m: number } | { type: "count"; n: number };

export interface Zone {
  id: ZoneKind;
  kind: ZoneKind;
  dataZone: DataZone;
  label: string;
  hint: string;
  points: Point3[];
  /** Direct-sun hours on the 15th of each month (index 0 = January). */
  sunByMonth: number[];
  capacity: Capacity;
  maxPotL: number;
  maxHeightCm: number;
  /** Gets rain (affects monsoon watering). */
  rain: boolean;
  /** 0 calm, 1 windy, 2 very windy. */
  wind: 0 | 1 | 2;
  /** Hot afternoon sun (west-ish, open). */
  heat: boolean;
}

export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  hottest: number;
  coldest: number;
  months: {
    m: number;
    tmax: number;
    tmin: number;
    tmax_hi: number;
    tmin_lo: number;
    rh: number;
    rain_mm: number;
    rainy_days: number;
    wind_max: number;
  }[];
}

export const DEFAULT_PROFILE: SpaceProfile = {
  v: 1,
  cityId: "pune",
  kind: "balcony",
  width: 1.8,
  depth: 1.2,
  ceiling: 2.8,
  facing: 270,
  floor: 3,
  railing: "grill",
  railingHeight: 1,
  sides: "both",
  frontView: "medium",
  frontHeight: "similar",
  trees: false,
  climberSupport: true,
  hooks: 2,
  shelf: false,
  walkway: true,
  seating: 0,
  water: "alternate",
  travels: false,
  experience: "new",
  goals: ["food", "fragrance"],
  pets: false,
  budget: null,
  sunCalibration: null,
  owned: [],
  gardenName: "",
  enjoy: "anytime",
  companions: "solo",
};

/** The balcony from the Indradhanu deck: Pune, 1.8 m × 1.2 m, about 4 h sun, low water. */
export const DEMO_PROFILE: SpaceProfile = {
  ...DEFAULT_PROFILE,
  cityId: "pune",
  width: 1.8,
  depth: 1.2,
  facing: 90,
  floor: 4,
  // "Low water" in the deck = a little water every 2–3 days, not daily.
  water: "alternate",
  goals: ["food", "fragrance", "pollinator"],
};
