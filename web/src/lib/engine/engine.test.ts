import { describe, expect, it } from "vitest";
import citiesJson from "@/data/cities.json";
import plantsJson from "@/data/plants_engine.json";
import { buildZones, capacityTotal } from "../space/zones";
import { DEFAULT_PROFILE, DEMO_PROFILE, type City, type SpaceProfile } from "../space/types";
import { buildPlan, maxPlants, servesGoal } from "./recommend";
import { todaysWatering, weatherAlerts } from "./care";
import { seasonCheck } from "./season";
import { impactFor } from "./impact";
import type { EnginePlant } from "./types";
import { normalsForecast, type Forecast } from "./weather";

const cities = citiesJson as unknown as City[];
const plants = plantsJson as unknown as EnginePlant[];
const byId = new Map(plants.map((p) => [p.id, p]));
const city = (id: string) => cities.find((c) => c.id === id)!;

function plan(over: Partial<SpaceProfile>, month = 10) {
  const s = { ...DEFAULT_PROFILE, ...over };
  const c = city(s.cityId);
  const zones = buildZones(s, c);
  return { s, c, zones, plan: buildPlan(plants, zones, s, c, { month }) };
}

describe("plan engine", () => {
  it("builds a sensible plan for the Pune demo balcony", () => {
    const { plan: pl, zones, s } = plan(DEMO_PROFILE);
    expect(pl.placements.length).toBeGreaterThanOrEqual(5);
    expect(pl.placements.length).toBeLessThanOrEqual(maxPlants(s));
    // Weekly watering: nothing thirsty unless it is drought tolerant.
    for (const pll of pl.placements) {
      const p = byId.get(pll.plantId)!;
      expect(p.water === "low" || p.drought_tolerance === "high" || p.water === "medium").toBe(true);
      expect(p.water).not.toBe("high");
    }
    // Every chosen goal is covered.
    for (const g of s.goals) expect(pl.placements.some((x) => servesGoal(byId.get(x.plantId)!, g))).toBe(true);
    // Zone capacity is respected.
    for (const cap of pl.capacity) expect(cap.used).toBeLessThanOrEqual(cap.total + 1e-6);
    // Every placement explains itself.
    for (const pll of pl.placements) expect(pll.reasons.length).toBeGreaterThan(0);
    expect(zones.length).toBeGreaterThan(2);
  });

  it("never suggests toxic plants when there are pets or kids", () => {
    const { plan: pl } = plan({ pets: true, goals: ["flowers", "sacred"] });
    for (const x of pl.placements) expect(byId.get(x.plantId)!.pet_safe).not.toBe("no");
  });

  it("only puts small pots on a windowsill", () => {
    const { plan: pl } = plan({ kind: "windowsill", width: 0.9, depth: 0.25, ceiling: 2.1, facing: 90 });
    expect(pl.placements.length).toBeGreaterThan(0);
    for (const x of pl.placements) expect(x.potL).toBeLessThanOrEqual(3);
  });

  it("only picks low-light plants for a dim indoor corner", () => {
    const { plan: pl } = plan({ kind: "indoor", width: 1, depth: 2.5, facing: 0, goals: [] });
    expect(pl.placements.length).toBeGreaterThan(0);
    for (const x of pl.placements) expect(byId.get(x.plantId)!.sun_min_hrs).toBeLessThanOrEqual(3);
  });

  it("plans around plants the user already owns", () => {
    const { plan: pl } = plan({ owned: ["tulsi", "money_plant"] });
    const owned = pl.placements.filter((x) => x.owned).map((x) => x.plantId);
    expect(owned).toContain("tulsi");
  });

  it("respects a budget", () => {
    const { plan: pl } = plan({ budget: 300 });
    const spend = pl.placements.reduce((a, x) => a + byId.get(x.plantId)!.price_inr_min, 0);
    expect(spend).toBeLessThanOrEqual(300);
  });

  it("explains why plants were left out", () => {
    const { plan: pl } = plan({ facing: 0, frontView: "near", frontHeight: "much_taller" });
    expect(pl.excluded.find((e) => e.reason === "less_sun")?.count ?? 0).toBeGreaterThan(10);
  });

  it("gives a big open terrace more plants than a tiny balcony", () => {
    const small = plan({ width: 1, depth: 0.9, hooks: 0, climberSupport: false, experience: "pro" }).plan;
    const terrace = plan({ kind: "terrace", ceiling: null, width: 6, depth: 5, railing: "solid", experience: "pro" }).plan;
    expect(terrace.placements.length).toBeGreaterThan(small.placements.length);
  });

  it("does not over-fill any zone", () => {
    const { plan: pl, zones } = plan({ experience: "pro", width: 3, depth: 1.5 });
    for (const z of zones) {
      const cap = pl.capacity.find((c) => c.zoneId === z.id)!;
      expect(cap.used).toBeLessThanOrEqual(capacityTotal(z) + 1e-6);
    }
  });
});

describe("living garden", () => {
  const { s, c, zones, plan: pl } = plan(DEMO_PROFILE);
  const zoneMap = new Map(zones.map((z) => [z.id as string, z]));
  const planted = pl.placements.map((x) => ({ ...x, planted: true }));

  it("skips watering open-air plants when heavy rain is forecast", () => {
    const rainy = { date: "2026-07-10", tmax: 27, tmin: 22, rain: 30, rainProb: 90, wind: 12, uv: 3 };
    const tasks = todaysWatering(planted, byId, zoneMap, rainy, {}, new Date("2026-07-10T08:00:00Z"));
    const open = tasks.filter((t) => zoneMap.get(t.zoneId)!.rain);
    expect(open.length).toBeGreaterThan(0);
    for (const t of open) expect(t.status).toBe("skip_rain");
  });

  it("waters more often in a heatwave", () => {
    const hot = { date: "2026-05-10", tmax: 41, tmin: 28, rain: 0, rainProb: 0, wind: 10, uv: 11 };
    const mild = { ...hot, tmax: 26 };
    const t1 = todaysWatering(planted, byId, zoneMap, hot, {}, new Date("2026-05-10T08:00:00Z"));
    const t2 = todaysWatering(planted, byId, zoneMap, mild, {}, new Date("2026-05-10T08:00:00Z"));
    const avg = (ts: typeof t1) => ts.reduce((a, t) => a + t.intervalDays, 0) / ts.length;
    expect(avg(t1)).toBeLessThan(avg(t2));
  });

  it("only schedules watering for planted plants, and waters new ones right away", () => {
    const day = { date: "2026-03-10", tmax: 30, tmin: 18, rain: 0, rainProb: 0, wind: 10, uv: 8 };
    expect(todaysWatering(pl.placements, byId, zoneMap, day, {})).toHaveLength(0);
    const tasks = todaysWatering(planted, byId, zoneMap, day, {});
    expect(tasks.every((t) => t.status === "due")).toBe(true);
    const watered = Object.fromEntries(planted.map((x) => [x.plantId, new Date().toISOString()]));
    expect(todaysWatering(planted, byId, zoneMap, day, watered).every((t) => t.status === "ok")).toBe(true);
  });

  it("raises heatwave and heavy-rain alerts tied to plants", () => {
    const f: Forecast = { ...normalsForecast(c), source: "live" };
    f.days[1] = { ...f.days[1], tmax: 41 };
    f.days[2] = { ...f.days[2], rain: 45 };
    const alerts = weatherAlerts(f, pl.placements, byId, zoneMap, s);
    expect(alerts.map((a) => a.id)).toEqual(expect.arrayContaining(["heat", "rain"]));
  });

  it("suggests moving a plant when its spot loses sun with the season", () => {
    // South-facing Pune balcony: bright in winter, almost no direct sun in June.
    const south = { ...DEFAULT_PROFILE, facing: 180 as const, hooks: 2, shelf: true };
    const zs = buildZones(south, c);
    const winterPlan = buildPlan(plants, zs, south, c, { month: 12 });
    const advice = seasonCheck(winterPlan.placements, byId, zs, south, c, 6);
    expect(advice.some((a) => a.kind === "move" || a.kind === "low_sun")).toBe(true);
  });

  it("computes impact and a harmony score between 0 and 100", () => {
    const im = impactFor(pl.placements, byId, zones, s, plants, pl.placements.map(() => 0.9));
    expect(im.greenAreaM2).toBeGreaterThan(0);
    expect(im.harmony.total).toBeGreaterThan(0);
    expect(im.harmony.total).toBeLessThanOrEqual(100);
    expect(im.waterLPerWeek).toBeLessThanOrEqual(im.baselineWaterLPerWeek);
  });
});
