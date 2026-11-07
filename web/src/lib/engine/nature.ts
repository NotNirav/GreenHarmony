import type { SpaceProfile } from "../space/types";
import type { Impact } from "./impact";
import type { EnginePlant, Placement } from "./types";

export interface Milestone {
  id: string;
  title: string;
  text: string;
  done: boolean;
  /** What to do to unlock it. */
  hint: string;
}

export interface NatureStory {
  plants: number;
  planted: number;
  greenM2: number;
  beeFriendly: number;
  food: number;
  fragrant: number;
  waterSavedLPerYear: number;
  co2KgPerYear: [number, number];
  ripples: { label: string; homes: number; greenM2: number; beeFriendly: number; waterSavedKL: number; co2Tonnes: [number, number] }[];
  milestones: Milestone[];
}

/** Homes in a typical Indian housing society tower / colony lane. */
export const BUILDING_HOMES = 40;
/** A deliberately modest city-scale "what if": 10,000 balconies (well under 1% of homes in a big Indian city). */
export const CITY_BALCONIES = 10_000;

/**
 * The garden's contribution to nature, plus what it would add up to if neighbours joined in.
 * All figures are model-based estimates and labelled as such in the UI.
 */
export function natureStory(placements: Placement[], plants: Map<string, EnginePlant>, impact: Impact, space: SpaceProfile): NatureStory {
  const all = placements.map((pl) => ({ pl, p: plants.get(pl.plantId) })).filter((x): x is { pl: Placement; p: EnginePlant } => !!x.p);
  const planted = all.filter((x) => x.pl.planted);
  const beeFriendly = all.filter((x) => x.p.pollinator >= 2).length;
  const food = all.filter((x) => x.p.edible).length;
  const fragrant = all.filter((x) => x.p.benefits.includes("fragrance")).length;
  const waterSavedLPerYear = Math.max(0, Math.round((impact.baselineWaterLPerWeek - impact.waterLPerWeek) * 52));

  const ripple = (label: string, homes: number) => ({
    label,
    homes,
    greenM2: Math.round(impact.greenAreaM2 * homes),
    beeFriendly: beeFriendly * homes,
    waterSavedKL: Math.round((waterSavedLPerYear * homes) / 1000),
    co2Tonnes: [Math.round((impact.co2KgPerYear[0] * homes) / 100) / 10, Math.round((impact.co2KgPerYear[1] * homes) / 100) / 10] as [number, number],
  });

  const plantedP = planted.map((x) => x.p);
  const zonesPlanted = new Set(planted.map((x) => x.pl.zoneId)).size;
  const milestones: Milestone[] = [
    { id: "sprout", title: "First sprout", text: "Your first plant is in a pot.", done: plantedP.length >= 1, hint: "Mark one plant as planted" },
    {
      id: "bees",
      title: "Bee buddy",
      text: "3 plants feeding bees and butterflies.",
      done: plantedP.filter((p) => p.pollinator >= 2).length >= 3,
      hint: "Plant 3 bee-friendly plants",
    },
    { id: "kitchen", title: "Kitchen gardener", text: "3 plants you can eat.", done: plantedP.filter((p) => p.edible).length >= 3, hint: "Plant 3 food plants" },
    {
      id: "water",
      title: "Water wise",
      text: "A garden that uses far less water than a thirsty mix.",
      done: plantedP.length >= 3 && impact.waterSavedPct >= 30,
      hint: "Plant 3+ with a water-saving plan",
    },
    { id: "wall", title: "Green wall", text: "A climber is greening your wall.", done: planted.some((x) => x.pl.zoneId === "climber"), hint: "Plant a climber on your grill" },
    { id: "layers", title: "Every layer", text: "Plants growing in 3 different spots.", done: zonesPlanted >= 3, hint: "Plant in 3 different spots" },
    {
      id: "pooja",
      title: "Pooja garden",
      text: "2 plants for daily pooja.",
      done: plantedP.filter((p) => p.benefits.includes("sacred")).length >= 2,
      hint: "Plant 2 pooja plants",
    },
  ].filter((m) => m.id !== "wall" || space.climberSupport);

  return {
    plants: all.length,
    planted: planted.length,
    greenM2: impact.greenAreaM2,
    beeFriendly,
    food,
    fragrant,
    waterSavedLPerYear,
    co2KgPerYear: impact.co2KgPerYear,
    ripples: [ripple(`Your building (~${BUILDING_HOMES} homes)`, BUILDING_HOMES), ripple(`${CITY_BALCONIES.toLocaleString("en-IN")} balconies in your city`, CITY_BALCONIES)],
    milestones,
  };
}
