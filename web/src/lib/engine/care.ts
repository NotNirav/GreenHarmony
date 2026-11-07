import type { City, SpaceProfile, Zone } from "../space/types";
import type { EnginePlant, Placement } from "./types";
import type { DayForecast, Forecast } from "./weather";

export interface Alert {
  id: string;
  level: "warn" | "info";
  title: string;
  body: string;
  plantIds: string[];
  day: string;
}

const DAY = 86_400_000;

/** Days between waterings for one plant, given today's max temperature. */
export function wateringInterval(p: EnginePlant, potL: number, zone: Zone, tmax: number): number {
  const base = { low: 6, medium: 3, high: 1.5 }[p.water];
  const heat = tmax >= 38 ? 0.5 : tmax >= 34 ? 0.7 : tmax >= 28 ? 1 : tmax >= 22 ? 1.4 : 2;
  const pot = potL <= 3 ? 0.7 : potL >= 20 ? 1.3 : 1;
  const spot = zone.kind === "hanging" ? 0.8 : zone.kind === "indoor" || zone.kind === "windowsill" ? 1.3 : 1;
  const drought = p.drought_tolerance === "high" ? 1.25 : 1;
  return Math.max(1, Math.min(14, Math.round(base * heat * pot * spot * drought)));
}

export interface WaterTask {
  plantId: string;
  zoneId: string;
  status: "due" | "skip_rain" | "ok";
  intervalDays: number;
  /** Litres to give this time (rough). */
  litres: number;
  note: string;
}

/** Today's watering list: what's due, what can skip because rain is coming, what's fine. */
export function todaysWatering(
  placements: Placement[],
  plants: Map<string, EnginePlant>,
  zones: Map<string, Zone>,
  today: DayForecast,
  watered: Record<string, string>,
  now = new Date(),
): WaterTask[] {
  return placements
    // Only plants that are actually in pots get a watering schedule.
    .filter((pl) => pl.planted && plants.has(pl.plantId) && zones.has(pl.zoneId))
    .map((pl) => {
      const p = plants.get(pl.plantId)!;
      const z = zones.get(pl.zoneId)!;
      const interval = wateringInterval(p, pl.potL, z, today.tmax);
      // Never watered since planting → due now.
      const last = watered[pl.plantId] ? new Date(watered[pl.plantId]).getTime() : 0;
      const days = last ? Math.floor((now.getTime() - last) / DAY) : Infinity;
      const litres = Math.round(Math.max(0.2, pl.potL * 0.15) * 10) / 10;
      if (z.rain && today.rain >= 5) {
        return { plantId: p.id, zoneId: z.id, status: "skip_rain" as const, intervalDays: interval, litres, note: `${today.rain} mm rain expected` };
      }
      if (days >= interval) {
        const note = today.tmax >= 36 ? "Hot day: water early morning, check again in the evening" : `Every ${interval} day${interval > 1 ? "s" : ""} right now`;
        return { plantId: p.id, zoneId: z.id, status: "due" as const, intervalDays: interval, litres, note };
      }
      return { plantId: p.id, zoneId: z.id, status: "ok" as const, intervalDays: interval, litres, note: `Next in ${interval - days} day${interval - days > 1 ? "s" : ""}` };
    })
    .sort((a, b) => ["due", "skip_rain", "ok"].indexOf(a.status) - ["due", "skip_rain", "ok"].indexOf(b.status));
}

/** Weather alerts for the next 7 days, each tied to the plants it affects. */
export function weatherAlerts(
  forecast: Forecast,
  placements: Placement[],
  plants: Map<string, EnginePlant>,
  zones: Map<string, Zone>,
  space: SpaceProfile,
): Alert[] {
  const alerts: Alert[] = [];
  const placed = placements.filter((pl) => plants.has(pl.plantId)).map((pl) => ({ pl, p: plants.get(pl.plantId)!, z: zones.get(pl.zoneId) }));
  const name = (id: string) => plants.get(id)!.common_name.split(" (")[0];
  const list = (ids: string[]) => (ids.length > 3 ? `${ids.slice(0, 3).map(name).join(", ")} +${ids.length - 3} more` : ids.map(name).join(", "));
  const when = (d: DayForecast, i: number) => (i === 0 ? "today" : i === 1 ? "tomorrow" : new Date(d.date).toLocaleDateString("en-IN", { weekday: "long" }));

  const hot = forecast.days.findIndex((d) => d.tmax >= 38);
  if (hot >= 0) {
    const d = forecast.days[hot];
    const at = placed.filter((x) => x.p.temp_max_c < d.tmax + 3 || x.z?.kind === "hanging" || x.pl.potL <= 3).map((x) => x.p.id);
    alerts.push({
      id: "heat",
      level: "warn",
      title: `Heatwave ${when(d, hot)}: ${Math.round(d.tmax)} °C`,
      body: `Water early morning and again in the evening. Move small pots away from the railing and use a shade net from noon to 4 pm.${at.length ? ` Most at risk: ${list(at)}.` : ""}`,
      plantIds: at,
      day: d.date,
    });
  }

  const wet = forecast.days.findIndex((d) => d.rain >= 20);
  if (wet >= 0) {
    const d = forecast.days[wet];
    const open = placed.filter((x) => x.z?.rain).map((x) => x.p.id);
    const soggy = placed.filter((x) => x.z?.rain && (x.p.drought_tolerance === "high" || x.p.category === "succulent")).map((x) => x.p.id);
    alerts.push({
      id: "rain",
      level: "warn",
      title: `Heavy rain ${when(d, wet)}: ${Math.round(d.rain)} mm`,
      body: `Skip watering open-air pots and make sure drainage holes are clear.${soggy.length ? ` Move ${list(soggy)} under cover — they rot in soggy soil.` : ""}`,
      plantIds: soggy.length ? soggy : open,
      day: d.date,
    });
  }

  const cold = forecast.days.findIndex((d) => d.tmin <= 8);
  if (cold >= 0) {
    const d = forecast.days[cold];
    const tender = placed.filter((x) => x.p.temp_min_c >= d.tmin - 1).map((x) => x.p.id);
    if (tender.length)
      alerts.push({
        id: "cold",
        level: "warn",
        title: `Cold night ${when(d, cold)}: ${Math.round(d.tmin)} °C`,
        body: `Cover ${list(tender)} with a cloth after sunset or move them indoors overnight.`,
        plantIds: tender,
        day: d.date,
      });
  }

  const gusty = forecast.days.findIndex((d) => d.wind >= (space.floor >= 8 ? 28 : 38));
  if (gusty >= 0) {
    const d = forecast.days[gusty];
    const tall = placed.filter((x) => x.z?.kind === "hanging" || x.p.height_cm >= 120 || x.z?.kind === "railing").map((x) => x.p.id);
    alerts.push({
      id: "wind",
      level: "info",
      title: `Strong wind ${when(d, gusty)}: ${Math.round(d.wind)} km/h`,
      body: `Take down hanging baskets or tie them tight, and secure railing planters.${tall.length ? ` Check ${list(tall)}.` : ""}`,
      plantIds: tall,
      day: d.date,
    });
  }

  const uv = forecast.days[0]?.uv ?? 0;
  if (uv >= 10 && hot < 0) {
    const tender = placed.filter((x) => x.p.sun_max_hrs <= 4 && (x.z?.sunByMonth[new Date().getMonth()] ?? 0) > 2).map((x) => x.p.id);
    if (tender.length)
      alerts.push({
        id: "uv",
        level: "info",
        title: `Very strong sun today (UV ${Math.round(uv)})`,
        body: `${list(tender)} prefer gentler light. Give them afternoon shade.`,
        plantIds: tender,
        day: forecast.days[0].date,
      });
  }
  return alerts;
}

export interface MonthTask {
  month: number;
  kind: "plant" | "harvest" | "feed" | "prune" | "protect";
  text: string;
  plantIds: string[];
}

/** 12-month care calendar for the plan, derived from each plant's Indian season data. */
export function careCalendar(placements: Placement[], plants: Map<string, EnginePlant>, city: City): MonthTask[] {
  const tasks: MonthTask[] = [];
  const ps = placements.map((pl) => plants.get(pl.plantId)).filter((p): p is EnginePlant => !!p);
  const names = (xs: EnginePlant[]) => xs.map((p) => p.common_name.split(" (")[0]).join(", ");
  for (let m = 1; m <= 12; m++) {
    const sow = ps.filter((p) => p.lifecycle !== "perennial" && p.plant_months.includes(m));
    if (sow.length) tasks.push({ month: m, kind: "plant", text: `Sow or replant ${names(sow)}`, plantIds: sow.map((p) => p.id) });
    const peak = ps.filter((p) => p.peak_months.includes(m) && p.peak_months.length < 12);
    if (peak.length) {
      const food = peak.filter((p) => p.edible);
      const bloom = peak.filter((p) => !p.edible);
      if (food.length) tasks.push({ month: m, kind: "harvest", text: `Harvest ${names(food)}`, plantIds: food.map((p) => p.id) });
      if (bloom.length) tasks.push({ month: m, kind: "harvest", text: `Peak blooms: ${names(bloom)}`, plantIds: bloom.map((p) => p.id) });
    }
    const c = city.months[m - 1];
    if (c.tmax >= 34 || c.rain_mm < 150) {
      if (m >= 3 && m <= 10) tasks.push({ month: m, kind: "feed", text: "Feed every pot with a handful of compost or vermicompost", plantIds: [] });
    }
    if (c.tmax_hi >= 38) tasks.push({ month: m, kind: "protect", text: `Expect ${Math.round(c.tmax_hi)} °C peaks: mulch pots and shade the hottest spots`, plantIds: [] });
    if (c.rain_mm >= 200) tasks.push({ month: m, kind: "protect", text: `Monsoon (${c.rain_mm} mm): clear drainage, watch for fungus, reduce watering of open pots`, plantIds: [] });
    if (c.tmin_lo <= 8) tasks.push({ month: m, kind: "protect", text: `Cold nights (${Math.round(c.tmin_lo)} °C): cover tender plants after sunset`, plantIds: [] });
    const prune = ps.filter((p) => /prun|cut back|trim/i.test(p.care_tip) && (p.peak_months.length ? !p.peak_months.includes(m) && p.peak_months.includes(((m + 10) % 12) + 1) : false));
    if (prune.length) tasks.push({ month: m, kind: "prune", text: `Prune after flowering: ${names(prune)}`, plantIds: prune.map((p) => p.id) });
  }
  return tasks;
}
