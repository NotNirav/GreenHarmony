import type { Category, Level, SunClass, Zone } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  herb: "Herbs",
  vegetable: "Vegetables",
  fruit: "Fruits",
  flowering: "Flowering",
  foliage: "Foliage & Indoor",
  succulent: "Succulents",
  climber: "Climbers",
  medicinal: "Medicinal",
};

export const ZONE_LABEL: Record<Zone, string> = {
  floor: "Floor pots",
  railing: "Railing",
  wall: "Wall / grill",
  hanging: "Hanging",
  rack: "Shelf / rack",
  windowsill: "Windowsill",
  indoor: "Indoors",
};

export const ZONE_HINT: Record<Zone, string> = {
  floor: "Big pots and grow bags",
  railing: "Planters on the balcony edge",
  wall: "Climbers on grills and trellis",
  hanging: "Baskets that spill over",
  rack: "Tiered stands and shelves",
  windowsill: "Small pots by the window",
  indoor: "Low light, inside the home",
};

export const SUN_LABEL: Record<SunClass, string> = {
  full_sun: "Full sun",
  partial_sun: "Partial sun",
  shade: "Shade / indoor",
};

export const LEVEL_LABEL: Record<Level, string> = { low: "Low", medium: "Medium", high: "High" };

export const AVAILABILITY_LABEL = {
  everywhere: "Every nursery",
  common: "Most nurseries",
  specialty: "Specialty",
} as const;

export const BENEFIT_LABEL: Record<string, string> = {
  food: "Food",
  herb: "Kitchen herb",
  fragrance: "Fragrance",
  flowers: "Flowers",
  pollinator: "Pollinators",
  medicinal: "Medicinal",
  air: "Indoor air",
  privacy: "Privacy",
  shade: "Shade",
  sacred: "Pooja / sacred",
  ornamental: "Ornamental",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const INSIGHT_CATEGORY_LABEL: Record<string, string> = {
  watering: "Watering",
  sunlight: "Sunlight",
  soil: "Soil & compost",
  pests: "Pests",
  seasonal: "This season",
  climate: "Climate",
  beginner: "Beginner",
  culture: "Culture",
  fact: "Did you know",
  impact: "Impact",
  food: "Grow food",
  space: "Small spaces",
};

export function inr(min: number, max: number): string {
  return min === max ? `₹${min}` : `₹${min}–${max}`;
}

export function sunHours(min: number, max: number): string {
  if (max === 0) return "No direct sun";
  if (min === max) return `${min} h sun`;
  return `${min}–${max} h sun`;
}

export function heightLabel(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(cm % 100 ? 1 : 0)} m` : `${cm} cm`;
}
