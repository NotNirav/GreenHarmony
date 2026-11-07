import { capacityTotal, footprint, standardPot } from "../space/zones";
import type { City, Goal, SpaceProfile, Zone, ZoneKind } from "../space/types";
import type { Breakdown, Candidate, EnginePlant, ExcludeReason, Placement, Plan } from "./types";
import { KID_FAVOURITES, MORNING_BLOOMS, NIGHT_FRAGRANT, TOLERANCE, WEIGHTS } from "./weights";

const WATER_LEVEL = { low: 1, medium: 2, high: 3 } as const;
const HABIT_ZONES: Partial<Record<ZoneKind, (p: EnginePlant) => boolean>> = {
  climber: (p) => p.habit === "climber",
};

export const GOAL_LABEL: Record<Goal, string> = {
  food: "Grow food",
  fragrance: "Fragrance",
  flowers: "Flowers & colour",
  sacred: "Pooja plants",
  pollinator: "Bees & butterflies",
  medicinal: "Medicinal",
  privacy: "Privacy & shade",
  low_effort: "Low effort",
};

export function servesGoal(p: EnginePlant, g: Goal): boolean {
  switch (g) {
    case "food":
      return p.benefits.includes("food") || p.benefits.includes("herb");
    case "fragrance":
      return p.benefits.includes("fragrance");
    case "flowers":
      return p.benefits.includes("flowers");
    case "sacred":
      return p.benefits.includes("sacred");
    case "pollinator":
      return p.pollinator >= 2;
    case "medicinal":
      return p.benefits.includes("medicinal");
    case "privacy":
      return p.benefits.includes("privacy") || p.benefits.includes("shade");
    case "low_effort":
      return p.maintenance <= 1 && p.drought_tolerance !== "low";
  }
}

const GOAL_REASON: Record<Goal, (p: EnginePlant) => string> = {
  food: (p) => (p.benefits.includes("herb") ? "Fresh kitchen herb" : "Grows food you can eat"),
  fragrance: () => "Adds fragrance",
  flowers: () => "Brings flowers and colour",
  sacred: () => "Used in pooja",
  pollinator: () => "Feeds bees and butterflies",
  medicinal: () => "Medicinal plant",
  privacy: () => "Adds privacy and shade",
  low_effort: () => "Very low effort",
};

/** Can this plant physically go in this kind of zone? */
function fitsZoneKind(p: EnginePlant, z: Zone): boolean {
  const special = HABIT_ZONES[z.kind];
  if (special) return special(p);
  if (p.habit === "climber" && z.kind !== "hanging" && z.kind !== "indoor") return false;
  if (p.zones.includes(z.dataZone)) return true;
  // Small plants listed for railing/windowsill/rack also sit happily in a floor pot or on a shelf.
  if (z.dataZone === "floor") return p.min_pot_l <= 15 && p.zones.some((x) => ["railing", "windowsill", "rack"].includes(x));
  if (z.dataZone === "rack") return p.zones.includes("windowsill") && p.min_pot_l <= 5;
  if (z.dataZone === "windowsill") return p.zones.includes("rack") && p.min_pot_l <= 3;
  return false;
}

/** Months the plant will be growing in its spot if planned now (used to average sun and climate). */
function growingWindow(p: EnginePlant, month: number): number[] {
  const span = p.lifecycle === "perennial" ? 4 : Math.min(5, Math.max(2, Math.ceil((p.days_to_harvest || 90) / 30)));
  return Array.from({ length: span }, (_, i) => ((month - 1 + i) % 12) + 1);
}

function userWaterLevel(s: SpaceProfile): number {
  const base = { daily: 3, alternate: 2, weekly: 1 }[s.water];
  return Math.max(1, base - (s.travels ? 1 : 0));
}

function cityName(city: City) {
  return city.name.split(" (")[0];
}

interface Evaluation {
  candidate?: Candidate;
  fail?: ExcludeReason;
}

/** Hard constraints + weighted score for one plant in one zone (see weights.ts). */
export function evaluate(p: EnginePlant, z: Zone, s: SpaceProfile, city: City, month: number, relax = false): Evaluation {
  const tol = relax ? TOLERANCE.relaxed : TOLERANCE.strict;
  if (!fitsZoneKind(p, z)) return { fail: "no_spot" };
  if (p.min_pot_l > z.maxPotL || p.height_cm > z.maxHeightCm) return { fail: "no_spot" };
  const safetyFirst = s.pets || s.companions === "kids";
  if (safetyFirst && p.pet_safe === "no") return { fail: "pets" };

  // ---- Hard rule: sun, both over the coming season and right now. ----
  const window = growingWindow(p, month);
  const sun = window.reduce((a, m) => a + z.sunByMonth[m - 1], 0) / window.length;
  const sunNow = z.sunByMonth[month - 1];
  if (sun < p.sun_min_hrs - tol.sunSeason || sunNow < p.sun_min_hrs - tol.sunNow) return { fail: "less_sun" };
  if (p.sun_max_hrs <= 4 && sun > p.sun_max_hrs + 2.5) return { fail: "too_much_sun" };

  // ---- Hard rule: climate in the months it grows. ----
  const months = p.lifecycle === "perennial" ? city.months : city.months.filter((m) => window.includes(m.m));
  const heatBoost = z.heat && sun >= 4 ? 2 : 0;
  const hottest = Math.max(...months.map((m) => m.tmax)) + heatBoost;
  const peakHeat = Math.max(...months.map((m) => m.tmax_hi)) + heatBoost;
  const coldest = Math.min(...months.map((m) => m.tmin));
  const peakCold = Math.min(...months.map((m) => m.tmin_lo));
  // Covered, indoor or windowsill spots are buffered against the worst cold.
  const sheltered = z.kind === "indoor" || z.kind === "windowsill" || (s.ceiling !== null && z.kind !== "railing");
  const coldEff = coldest + (sheltered ? 2 : 0);
  if (hottest > p.temp_max_c + tol.heat) return { fail: "heat" };
  if (coldEff < p.temp_min_c - tol.cold) return { fail: "cold" };

  // ---- Hard rule: watering. ----
  const need = WATER_LEVEL[p.water];
  const can = userWaterLevel(s);
  if (need > can + (p.drought_tolerance === "high" ? 1 : 0)) return { fail: "water" };

  const reasons: string[] = [];
  const warnings: string[] = [];
  const b: Breakdown = {};

  // ---- Major: sun fit (25). ----
  let sunFit = 1;
  if (sun < p.sun_min_hrs) sunFit = 1 - (p.sun_min_hrs - sun) / 2;
  else if (sun > p.sun_max_hrs) sunFit = Math.max(0, 1 - (sun - p.sun_max_hrs) / 5);
  sunFit = Math.max(0, sunFit);
  b.sun = WEIGHTS.sun.pts * sunFit;
  const range = p.sun_min_hrs === p.sun_max_hrs ? `${p.sun_min_hrs}` : `${p.sun_min_hrs}–${p.sun_max_hrs}`;
  reasons.push(sun < 0.5 ? "Happy without direct sun" : `~${sun.toFixed(1)} h sun here · likes ${range} h`);
  if (sun < p.sun_min_hrs - 0.3) warnings.push("Slightly under its ideal sun: keep it at the brightest end of this spot.");
  if (sunNow < p.sun_min_hrs - 1) warnings.push("Gets less sun this month than later in the season.");

  // ---- Major: goals (25). ----
  const goalsHit = s.goals.filter((g) => servesGoal(p, g));
  const goalFit = s.goals.length ? Math.min(1, goalsHit.length / Math.min(2, s.goals.length)) : 0.5;
  b.goals = WEIGHTS.goals.pts * goalFit;
  for (const g of goalsHit.slice(0, 2)) reasons.push(GOAL_REASON[g](p));

  // ---- Major: climate margin (12). ----
  const margin = Math.min(p.temp_max_c - hottest, coldEff - p.temp_min_c);
  b.climate = WEIGHTS.climate.pts * Math.min(1, Math.max(0, (margin + 2) / 8));
  if (peakHeat >= 40 && p.temp_max_c >= peakHeat) reasons.push(`Takes ${cityName(city)}'s ${Math.round(peakHeat)} °C peaks in its stride`);
  // Only warn when this plant is clearly more fragile than the rest; garden-wide extremes are alerts.
  if (p.temp_max_c < peakHeat - 4) warnings.push(`Shade it on the hottest days (${cityName(city)} touches ${Math.round(peakHeat)} °C).`);
  if (p.temp_min_c > peakCold + (sheltered ? 2 : 0) + 4) warnings.push(`Cover it on the coldest nights (down to ${Math.round(peakCold)} °C).`);

  // ---- Major: water fit (8). Spare watering capacity scores higher. ----
  const waterFit = need < can ? 1 : need === can ? 0.7 : 0.3;
  b.water = WEIGHTS.water.pts * waterFit;
  if (p.water === "low" && s.water !== "daily") reasons.push("Low water: suits how often you water");
  if (s.travels && p.drought_tolerance === "high") reasons.push("Copes when you're away");

  // ---- Medium: easy to buy (10) — market availability first, then popularity. ----
  const avail = { everywhere: 1, common: 0.6, specialty: 0.2 }[p.availability];
  b.buyable = WEIGHTS.buyable.pts * (avail * 0.6 + (p.popularity / 5) * 0.4);
  if (p.availability === "everywhere" && p.popularity >= 4) reasons.push("Sold at every nursery");

  // ---- Medium: matches experience (7). ----
  const expFit = s.experience === "new" ? p.beginner_score / 100 : s.experience === "some" ? 0.5 + p.beginner_score / 200 : 0.8;
  b.experience = WEIGHTS.experience.pts * expFit;
  if (s.experience === "new" && p.beginner_score >= 70) reasons.push("Beginner-friendly");

  // ---- Medium: plant it now (5). ----
  const plantableNow = p.plant_months.includes(month);
  const soon = p.plant_months.includes((month % 12) + 1);
  const seasonFit = plantableNow ? 1 : soon ? 0.6 : p.lifecycle === "perennial" && p.propagation.includes("sapling") ? 0.6 : 0.2;
  b.season = WEIGHTS.season.pts * seasonFit;
  if (plantableNow) reasons.push("Good time to plant it now");
  else if (!soon && p.lifecycle !== "perennial") warnings.push(`Best sown in ${monthList(p.plant_months)}.`);

  // ---- Minor / fun (8): when you enjoy the balcony, who gardens with you. ----
  let fun = 0;
  if (s.enjoy === "evening" && NIGHT_FRAGRANT.has(p.id)) {
    fun += 5;
    reasons.push("Scents your evenings");
  }
  if (s.enjoy === "morning" && (MORNING_BLOOMS.has(p.id) || (p.pollinator >= 2 && p.benefits.includes("flowers")))) {
    fun += 4;
    reasons.push("Blooms and butterflies with your morning chai");
  }
  if (s.companions === "kids" && (KID_FAVOURITES.has(p.id) || (p.growth_rate === "fast" && p.pet_safe === "yes"))) {
    fun += 5;
    reasons.push("Fun for kids to grow");
  }
  if (s.companions === "family" && p.edible) fun += 3;
  b.fun = Math.min(WEIGHTS.fun.pts, fun);

  // ---- Microclimate penalties. ----
  let penalty = 0;
  if (z.wind === 2 && (p.height_cm > 150 || z.kind === "hanging")) {
    penalty += 10;
    warnings.push("Very windy up here: tie it to a support or use a heavy pot.");
  }
  if (s.floor >= 10 && ["bottle_gourd", "bitter_gourd", "ridge_gourd", "cucumber"].includes(p.id)) {
    penalty += 5;
    warnings.push("Few bees reach high floors: hand-pollinate flowers in the morning with a small brush.");
  }
  if (z.heat && p.water === "high") penalty += 6;
  if (z.kind === "hanging" && p.water === "high") penalty += 5;
  // Sprout trays (microgreens, wheatgrass) are a nice extra, not the backbone of a garden.
  if (p.days_to_harvest > 0 && p.days_to_harvest < 20) penalty += 18;
  if (p.humidity === "high" && avgRh(city, window) < 45) {
    penalty += 5;
    warnings.push("Likes humidity: mist the leaves in dry months.");
  }
  if (relax) {
    penalty += 15;
    warnings.unshift("Outside its comfort zone here: protect it from extremes (cover on cold nights, shade in heat).");
  }
  b.penalty = -penalty;

  const score = Object.values(b).reduce((a, v) => a + (v ?? 0), 0);
  for (const k of Object.keys(b) as (keyof Breakdown)[]) b[k] = Math.round((b[k] ?? 0) * 10) / 10;

  return {
    candidate: {
      plant: p,
      zone: z,
      score: Math.round(Math.max(0, Math.min(100, score))),
      sunFit,
      waterFit,
      sun: Math.round(sun * 10) / 10,
      potL: standardPot(Math.max(p.min_pot_l, z.kind === "hanging" ? 2 : 1)),
      reasons: dedupe(reasons).slice(0, 3),
      warnings: dedupe(warnings),
      breakdown: b,
      relaxed: relax || undefined,
    },
  };
}

function avgRh(city: City, months: number[]) {
  const ms = city.months.filter((m) => months.includes(m.m));
  return ms.reduce((a, m) => a + m.rh, 0) / ms.length;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthList(ms: number[]): string {
  if (ms.length >= 12) return "any month";
  return ms.map((m) => MONTH_SHORT[m - 1]).join(", ");
}

function dedupe(xs: string[]) {
  return [...new Set(xs)];
}

/** Effort budget: how many plants a person can realistically look after. */
export function maxPlants(s: SpaceProfile): number {
  const base = { new: 8, some: 12, pro: 18 }[s.experience];
  return Math.max(3, base - (s.travels ? 2 : 0) - (s.goals.includes("low_effort") ? 2 : 0));
}

export interface PlanOptions {
  month?: number;
  /** Placements to keep as-is (already planted / pinned by the user). */
  keep?: Placement[];
  /** Plant ids the user removed; never suggest them again. */
  exclude?: string[];
}

/** Build all feasible (plant, zone) candidates and the exclusion summary. */
export function candidates(plants: EnginePlant[], zones: Zone[], s: SpaceProfile, city: City, month: number, relax = false) {
  const out: Candidate[] = [];
  const fails = new Map<ExcludeReason, number>();
  const ORDER: ExcludeReason[] = ["pets", "no_spot", "less_sun", "too_much_sun", "heat", "cold", "water"];
  for (const p of plants) {
    let best: ExcludeReason | null = null;
    let ok = false;
    for (const z of zones) {
      const e = evaluate(p, z, s, city, month, relax);
      if (e.candidate) {
        out.push(e.candidate);
        ok = true;
      } else if (e.fail && (best === null || ORDER.indexOf(e.fail) > ORDER.indexOf(best))) {
        best = e.fail; // keep the "closest to working" failure as the explanation
      }
    }
    if (!ok && best) fails.set(best, (fails.get(best) ?? 0) + 1);
  }
  return { candidates: out, excluded: [...fails.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count) };
}

/**
 * Greedy combination optimiser: fill each zone's real capacity with the best-scoring plants
 * while rewarding goal coverage and penalising repetition (same category / habit).
 */
export function buildPlan(plants: EnginePlant[], zones: Zone[], s: SpaceProfile, city: City, opts: PlanOptions = {}): Plan {
  const month = opts.month ?? new Date().getMonth() + 1;
  const { candidates: all, excluded } = candidates(plants, zones, s, city, month);
  const banned = new Set(opts.exclude ?? []);
  const pool = all.filter((c) => !banned.has(c.plant.id));
  const used = new Map<ZoneKind, number>(zones.map((z) => [z.id, 0]));
  const placements: Placement[] = [];
  const chosen = new Set<string>();
  let spend = 0;

  const fits = (z: Zone, need: number) => (used.get(z.id) ?? 0) + need <= capacityTotal(z) + 1e-6;
  const take = (z: Zone, need: number) => used.set(z.id, (used.get(z.id) ?? 0) + need);
  // Climbers also need a floor pot at their base.
  const climberBase = zones.find((z) => z.id === "floor_front") ?? zones.find((z) => z.id === "floor_back");

  const place = (c: Candidate, extra: Partial<Placement> = {}) => {
    const need = footprint(c.zone, c.potL, c.plant.spread_cm);
    take(c.zone, need);
    if (c.zone.kind === "climber" && climberBase) take(climberBase, footprint(climberBase, c.potL, 40));
    chosen.add(c.plant.id);
    spend += c.plant.price_inr_min;
    placements.push({
      plantId: c.plant.id,
      zoneId: c.zone.id,
      potL: c.potL,
      score: c.score,
      reasons: c.reasons,
      warnings: c.warnings,
      breakdown: c.breakdown,
      alternatives: [],
      planted: false,
      owned: false,
      ...extra,
    });
  };

  // 1. Keep pinned/planted placements exactly where they are.
  for (const k of opts.keep ?? []) {
    const z = zones.find((x) => x.id === k.zoneId);
    const c = pool.find((x) => x.plant.id === k.plantId && x.zone.id === k.zoneId);
    if (!z) continue;
    if (c) place(c, { planted: k.planted, owned: k.owned, pinned: k.pinned });
    else {
      // Kept even if no longer ideal (the season check will suggest a move).
      const p = plants.find((x) => x.id === k.plantId);
      if (!p) continue;
      take(z, footprint(z, k.potL, p.spread_cm));
      chosen.add(p.id);
      placements.push({ ...k, warnings: [...k.warnings.filter((w) => !w.startsWith("Not ideal")), "Not ideal for this spot any more — see the season check."] });
    }
  }

  // 2. Plants the user already owns go to their best feasible spot.
  for (const id of s.owned) {
    if (chosen.has(id)) continue;
    const c = pool.filter((x) => x.plant.id === id).sort((a, b) => b.score - a.score).find((x) => fits(x.zone, footprint(x.zone, x.potL, x.plant.spread_cm)));
    if (c) place(c, { owned: true, planted: true });
  }

  // 3. Greedy fill.
  const limit = Math.max(maxPlants(s), placements.length);
  const covered = () => new Set(s.goals.filter((g) => placements.some((pl) => servesGoal(plants.find((p) => p.id === pl.plantId)!, g))));
  greedy(pool);

  // 4. Harsh spot or climate (deep shade, hill-station winter): relax tolerances rather than
  // return an empty garden, and say so on every plant that needed it.
  let relaxed = false;
  const minWanted = Math.min(3, limit);
  if (placements.length < minWanted) {
    const extra = candidates(plants, zones, s, city, month, true).candidates.filter((c) => !banned.has(c.plant.id));
    const before = placements.length;
    greedy(extra, minWanted);
    relaxed = placements.length > before;
    pool.push(...extra.filter((c) => !pool.some((x) => x.plant.id === c.plant.id && x.zone.id === c.zone.id)));
  }

  function greedy(source: Candidate[], cap = limit) {
  while (placements.length < cap) {
    const have = covered();
    const catCount = countBy(placements.map((pl) => plants.find((p) => p.id === pl.plantId)!.category));
    const habitCount = countBy(placements.map((pl) => plants.find((p) => p.id === pl.plantId)!.habit));
    const zoneCount = countBy(placements.map((pl) => pl.zoneId));
    let best: { c: Candidate; adj: number } | null = null;
    for (const c of source) {
      if (chosen.has(c.plant.id)) continue;
      const need = footprint(c.zone, c.potL, c.plant.spread_cm);
      if (!fits(c.zone, need)) continue;
      if (c.zone.kind === "climber" && climberBase && !fits(climberBase, footprint(climberBase, c.potL, 40))) continue;
      if (s.budget != null && spend + c.plant.price_inr_min > s.budget) continue;
      let adj = c.score;
      adj -= 9 * (catCount.get(c.plant.category) ?? 0);
      adj -= 3 * (habitCount.get(c.plant.habit) ?? 0);
      adj -= 2 * (zoneCount.get(c.zone.id) ?? 0); // spread plants across layers
      const newGoals = s.goals.filter((g) => !have.has(g) && servesGoal(c.plant, g)).length;
      adj += 14 * newGoals;
      if (!best || adj > best.adj) best = { c, adj };
    }
    if (!best || best.adj < 25) break;
    place(best.c);
  }
  }

  // Alternatives for "Swap": next best plants that fit the same spot.
  for (const pl of placements) {
    pl.alternatives = pool
      .filter((c) => c.zone.id === pl.zoneId && !chosen.has(c.plant.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((c) => c.plant.id);
  }

  return {
    createdAt: new Date().toISOString(),
    month,
    placements,
    excluded,
    relaxed: relaxed || undefined,
    capacity: zones.map((z) => ({ zoneId: z.id, used: Math.round((used.get(z.id) ?? 0) * 100) / 100, total: Math.round(capacityTotal(z) * 100) / 100 })),
  };
}

function countBy<T>(xs: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

export const EXCLUDE_LABEL: Record<ExcludeReason, (n: number) => string> = {
  less_sun: (n) => `${n} plants need more sun than your space gets`,
  too_much_sun: (n) => `${n} shade plants would scorch here`,
  heat: (n) => `${n} plants can't take your city's summer heat`,
  cold: (n) => `${n} plants can't take your city's winter cold`,
  water: (n) => `${n} plants need more frequent watering`,
  no_spot: (n) => `${n} plants have no suitable spot (size or type)`,
  pets: (n) => `${n} plants are toxic to pets or kids`,
  budget: (n) => `${n} plants are over budget`,
};

/** Plain-English reason a plant can't go anywhere on this space (null if it can). */
export function whyNot(p: EnginePlant, zones: Zone[], s: SpaceProfile, city: City, month: number): string | null {
  const ORDER: ExcludeReason[] = ["pets", "no_spot", "less_sun", "too_much_sun", "heat", "cold", "water"];
  let best: ExcludeReason | null = null;
  for (const z of zones) {
    const e = evaluate(p, z, s, city, month);
    if (e.candidate) return null;
    if (e.fail && (best === null || ORDER.indexOf(e.fail) > ORDER.indexOf(best))) best = e.fail;
  }
  const name = p.common_name.split(" (")[0];
  const sunniest = Math.max(0, ...zones.map((z) => z.sunByMonth[month - 1]));
  switch (best) {
    case "less_sun":
      return `${name} needs ${p.sun_min_hrs}+ h of direct sun; your sunniest spot gets about ${sunniest.toFixed(1)} h right now.`;
    case "too_much_sun":
      return `${name} prefers shade, and every spot here is too sunny for it.`;
    case "heat":
      return `${name} struggles in ${cityName(city)}'s summer heat (it likes up to ${p.temp_max_c} °C).`;
    case "cold":
      return `${name} can't take ${cityName(city)}'s winter cold (it needs above ${p.temp_min_c} °C).`;
    case "water":
      return `${name} needs watering more often than you said you can.`;
    case "pets":
      return `${name} is toxic to pets and small children.`;
    default:
      return `${name} has no spot that fits it here (pot size, height or it needs a grill to climb).`;
  }
}
