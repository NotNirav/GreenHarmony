/**
 * Quality tests for the core feature: does the planner suggest plants that would actually work
 * on that balcony, and do the answers carry the weight they should?
 */
import { describe, expect, it } from "vitest";
import citiesJson from "@/data/cities.json";
import plantsJson from "@/data/plants_engine.json";
import { buildZones, capacityTotal } from "../space/zones";
import { DEFAULT_PROFILE, type City, type Facing, type Goal, type SpaceProfile } from "../space/types";
import { buildPlan, evaluate } from "./recommend";
import { WEIGHTS } from "./weights";
import type { EnginePlant, Plan } from "./types";

const cities = citiesJson as unknown as City[];
const plants = plantsJson as unknown as EnginePlant[];
const byId = new Map(plants.map((p) => [p.id, p]));
const city = (id: string) => cities.find((c) => c.id === id)!;
const P = (o: Partial<SpaceProfile>): SpaceProfile => ({ ...DEFAULT_PROFILE, ...o });
const RELAXED = "Outside its comfort zone";

function run(s: SpaceProfile, month: number) {
  const c = city(s.cityId);
  const zones = buildZones(s, c);
  return { c, zones, plan: buildPlan(plants, zones, s, c, { month }) };
}
const ids = (pl: Plan) => pl.placements.map((x) => x.plantId);
const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length / Math.max(1, Math.max(a.length, b.length));

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function randomProfile(r: () => number): SpaceProfile {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const kind = pick(["balcony", "balcony", "balcony", "terrace", "windowsill", "indoor"] as const);
  const goals = (["food", "fragrance", "flowers", "sacred", "pollinator", "medicinal", "privacy", "low_effort"] as Goal[]).filter(() => r() < 0.25).slice(0, 3);
  const base = P({
    cityId: pick(cities).id,
    kind,
    facing: pick([0, 45, 90, 135, 180, 225, 270, 315] as Facing[]),
    floor: Math.floor(r() * 25),
    frontView: pick(["open", "far", "medium", "near"] as const),
    frontHeight: pick(["lower", "similar", "taller", "much_taller"] as const),
    trees: r() < 0.2,
    water: pick(["daily", "alternate", "weekly"] as const),
    travels: r() < 0.25,
    experience: pick(["new", "some", "pro"] as const),
    goals,
    pets: r() < 0.3,
    budget: r() < 0.25 ? pick([300, 500, 1000, 2000]) : null,
    enjoy: pick(["morning", "evening", "anytime"] as const),
    companions: pick(["solo", "family", "kids"] as const),
  });
  if (kind === "windowsill") return { ...base, width: 0.5 + r() * 1.2, depth: 0.25, ceiling: 2.1, railing: "none", hooks: 0, shelf: false, climberSupport: false };
  if (kind === "indoor") return { ...base, width: 0.6 + r(), depth: 0.4 + r() * 3, railing: "none", hooks: 0, shelf: false, climberSupport: false };
  if (kind === "terrace") return { ...base, width: 2 + r() * 8, depth: 2 + r() * 6, ceiling: null, railing: pick(["solid", "grill"] as const), sides: "none", hooks: Math.floor(r() * 3) };
  return {
    ...base,
    width: 0.9 + r() * 3,
    depth: 0.8 + r() * 1.8,
    ceiling: r() < 0.85 ? 2.6 + r() * 0.6 : null,
    railing: pick(["grill", "solid", "glass", "none"] as const),
    sides: pick(["none", "one", "both"] as const),
    climberSupport: r() < 0.6,
    hooks: Math.floor(r() * 4),
    shelf: r() < 0.3,
    walkway: r() < 0.7,
    seating: pick([0, 0, 1, 2] as const),
  };
}

describe("property: every suggestion obeys the hard rules (400 random balconies)", () => {
  const r = rng(42);
  const cases = Array.from({ length: 400 }, () => ({ s: randomProfile(r), month: 1 + Math.floor(r() * 12) }));
  let empty = 0;

  it.each(cases.map((c, i) => [i, c] as const))("case %i", (_, { s, month }) => {
    const { c, zones, plan } = run(s, month);
    if (plan.placements.length === 0) empty++;
    const seen = new Set<string>();
    let spend = 0;
    for (const pl of plan.placements) {
      const p = byId.get(pl.plantId)!;
      const z = zones.find((x) => x.id === pl.zoneId)!;
      expect(z, "placement zone exists").toBeTruthy();
      expect(seen.has(pl.plantId), "no duplicates").toBe(false);
      seen.add(pl.plantId);
      spend += p.price_inr_min;
      // Safety and physical fit hold even in the relaxed fallback.
      if (s.pets || s.companions === "kids") expect(p.pet_safe).not.toBe("no");
      expect(pl.potL).toBeLessThanOrEqual(z.maxPotL);
      if (z.kind === "climber") expect(p.habit).toBe("climber");
      if (z.kind === "windowsill") expect(pl.potL).toBeLessThanOrEqual(3);
      const relaxed = pl.warnings.some((w) => w.startsWith(RELAXED));
      if (relaxed) expect(plan.relaxed).toBe(true);
      else expect(evaluate(p, z, s, c, month).candidate, `${p.id} strictly feasible in ${z.id}`).toBeTruthy();
    }
    if (s.budget != null) expect(spend).toBeLessThanOrEqual(s.budget);
    for (const cap of plan.capacity) expect(cap.used).toBeLessThanOrEqual(cap.total + 1e-6);
  });

  it("almost never leaves someone with nothing to plant", () => {
    expect(empty / cases.length).toBeLessThan(0.05);
  });
});

describe("scenarios: suggestions make horticultural sense", () => {
  it("deep shade (north-facing, tall building close, December) → only low-light plants", () => {
    const { plan } = run(P({ cityId: "mumbai", facing: 0, frontView: "near", frontHeight: "much_taller" }), 12);
    expect(plan.placements.length).toBeGreaterThan(0);
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.sun_min_hrs).toBeLessThanOrEqual(3);
  });

  it("Pune south-facing in June (sun passes overhead to the north) → no sun-lovers", () => {
    const { plan, zones } = run(P({ facing: 180 }), 6);
    const sunNow = Math.max(...zones.map((z) => z.sunByMonth[5]));
    for (const pl of plan.placements) {
      const p = byId.get(pl.plantId)!;
      if (!pl.warnings.some((w) => w.startsWith(RELAXED))) expect(p.sun_min_hrs).toBeLessThanOrEqual(sunNow + 2);
    }
  });

  it("Delhi open terrace in June → only plants that take 40 °C+", () => {
    const { plan } = run(P({ cityId: "delhi", kind: "terrace", ceiling: null, width: 6, depth: 5, railing: "solid", water: "daily", experience: "pro" }), 6);
    expect(plan.placements.length).toBeGreaterThan(8);
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.temp_max_c).toBeGreaterThanOrEqual(38);
  });

  it("Shimla terrace in winter → only frost-hardy plants, no relaxing needed", () => {
    const { plan } = run(P({ cityId: "shimla", kind: "terrace", ceiling: null, width: 4, depth: 3, railing: "solid", goals: ["flowers"] }), 12);
    expect(plan.placements.length).toBeGreaterThanOrEqual(3);
    expect(plan.relaxed).toBeFalsy();
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.temp_min_c).toBeLessThanOrEqual(0);
  });

  it("Shimla in winter with a tiny windowsill → relaxed plan, flagged as needing protection", () => {
    const { plan } = run(P({ cityId: "shimla", kind: "windowsill", width: 1, depth: 0.3, goals: ["food"] }), 12);
    expect(plan.placements.length).toBeGreaterThan(0);
    if (plan.relaxed) expect(plan.placements.some((pl) => pl.warnings.some((w) => w.startsWith(RELAXED)))).toBe(true);
  });

  it("weekly watering in Chennai → no thirsty plants", () => {
    const { plan } = run(P({ cityId: "chennai", water: "weekly" }), 4);
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.water).not.toBe("high");
  });

  it("indoor corner 2.5 m from a north window → indoor plants only", () => {
    const { plan } = run(P({ cityId: "bengaluru", kind: "indoor", width: 1, depth: 2.5, facing: 0, railing: "none", hooks: 0, climberSupport: false }), 8);
    expect(plan.placements.length).toBeGreaterThan(0);
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.zones).toContain("indoor");
  });

  it("a food goal fills the garden mostly with things you can eat", () => {
    const { plan } = run(P({ cityId: "pune", facing: 90, goals: ["food"], water: "daily" }), 10);
    const edible = plan.placements.filter((pl) => byId.get(pl.plantId)!.edible).length;
    expect(edible / plan.placements.length).toBeGreaterThanOrEqual(0.5);
  });

  it("first-time gardeners get easy plants", () => {
    const { plan } = run(P({ experience: "new", facing: 90 }), 10);
    const avg = plan.placements.reduce((a, pl) => a + byId.get(pl.plantId)!.beginner_score, 0) / plan.placements.length;
    expect(avg).toBeGreaterThanOrEqual(60);
  });

  it("very high, windy floors warn about hanging pots", () => {
    const { plan } = run(P({ floor: 22, hooks: 3, facing: 90 }), 10);
    for (const pl of plan.placements.filter((x) => x.zoneId === "hanging")) expect(pl.warnings.some((w) => /windy/i.test(w))).toBe(true);
  });

  it("market availability matters: most suggestions are sold widely", () => {
    const { plan } = run(P({ facing: 90, goals: ["flowers"] }), 10);
    const widely = plan.placements.filter((pl) => byId.get(pl.plantId)!.availability !== "specialty").length;
    expect(widely / plan.placements.length).toBeGreaterThanOrEqual(0.85);
  });
});

describe("weights: major answers steer, fun answers only nudge", () => {
  it("weights add up to 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, w) => a + w.pts, 0)).toBe(100);
  });

  it("the score is the sum of its breakdown", () => {
    const { plan } = run(P({ facing: 90, enjoy: "evening", companions: "kids" }), 10);
    for (const pl of plan.placements) {
      const sum = Object.values(pl.breakdown ?? {}).reduce((a, v) => a + (v ?? 0), 0);
      expect(Math.abs(Math.max(0, Math.min(100, sum)) - pl.score)).toBeLessThanOrEqual(1);
    }
  });

  it("direction (a major input) changes the plan a lot", () => {
    const north = ids(run(P({ facing: 0, frontView: "medium" }), 12).plan);
    const south = ids(run(P({ facing: 180, frontView: "medium" }), 12).plan);
    expect(overlap(north, south)).toBeLessThan(0.6);
  });

  it("goals (a major input) change the plan a lot", () => {
    const food = ids(run(P({ facing: 90, goals: ["food"] }), 10).plan);
    const flowers = ids(run(P({ facing: 90, goals: ["flowers", "fragrance"] }), 10).plan);
    expect(overlap(food, flowers)).toBeLessThan(0.6);
  });

  it("fun answers nudge but don't overturn the plan", () => {
    const plain = ids(run(P({ facing: 90, enjoy: "anytime", companions: "solo" }), 10).plan);
    const evening = ids(run(P({ facing: 90, enjoy: "evening", companions: "solo" }), 10).plan);
    expect(overlap(plain, evening)).toBeGreaterThanOrEqual(0.5);
  });

  it("fun answers never add more than their weight to a plant", () => {
    const { plan } = run(P({ facing: 90, enjoy: "evening", companions: "kids" }), 10);
    for (const pl of plan.placements) expect(pl.breakdown?.fun ?? 0).toBeLessThanOrEqual(WEIGHTS.fun.pts);
  });

  it("evening lovers get a night-fragrant plant when one fits", () => {
    const { plan } = run(P({ facing: 90, enjoy: "evening", goals: ["fragrance"], water: "daily" }), 10);
    expect(plan.placements.some((pl) => ["raat_ki_rani", "mogra", "juhi", "chameli", "parijat", "tuberose", "kamini", "madhumalti", "kunda", "plumeria", "tagar"].includes(pl.plantId))).toBe(true);
  });

  it("kids at home → toxic plants are left out, like with pets", () => {
    const { plan } = run(P({ companions: "kids", goals: ["flowers"] }), 10);
    for (const pl of plan.placements) expect(byId.get(pl.plantId)!.pet_safe).not.toBe("no");
  });

  it("zone capacity is never exceeded, even on a tiny balcony with a pro gardener", () => {
    const s = P({ width: 1, depth: 0.9, experience: "pro", hooks: 1 });
    const { plan, zones } = run(s, 10);
    for (const z of zones) expect(plan.capacity.find((x) => x.zoneId === z.id)!.used).toBeLessThanOrEqual(capacityTotal(z) + 1e-6);
  });
});
