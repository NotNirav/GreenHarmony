"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildZones } from "../space/zones";
import type { SpaceProfile } from "../space/types";
import { careCalendar, todaysWatering, weatherAlerts } from "./care";
import { cityMap, enginePlantMap, enginePlants } from "./data";
import { impactFor } from "./impact";
import { natureStory } from "./nature";
import { buildPlan, evaluate, whyNot } from "./recommend";
import { seasonCheck } from "./season";
import { loadGarden, saveGarden, type GardenState } from "./store";
import type { Placement } from "./types";
import { getForecast, normalsForecast, type Forecast } from "./weather";

/** Create a fresh garden (or re-plan an existing one, keeping what is already planted). */
export function planGarden(profile: SpaceProfile, previous?: GardenState | null): GardenState {
  const city = cityMap.get(profile.cityId)!;
  const zones = buildZones(profile, city);
  // Keep everything the user decided: planted, already owned, or chosen by swap / move / add.
  const keep = (previous?.plan.placements ?? []).filter((p) => p.planted || p.owned || p.pinned);
  const plan = buildPlan(enginePlants, zones, profile, city, { keep, exclude: previous?.removed });
  const now = new Date().toISOString();
  return {
    v: 1,
    profile,
    plan,
    watered: previous?.watered ?? {},
    removed: previous?.removed ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

/** The living garden: saved state + everything derived from it (zones, weather, care, season advice). */
export function useGarden() {
  const [state, setState] = useState<GardenState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const latest = useRef<GardenState | null>(null);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    const id = setTimeout(() => {
      setState(loadGarden());
      setLoaded(true);
    });
    return () => clearTimeout(id);
  }, []);

  const update = useCallback((fn: (g: GardenState) => GardenState) => {
    setState((g) => {
      if (!g) return g;
      const next = fn(g);
      saveGarden(next);
      return next;
    });
  }, []);

  const city = state ? cityMap.get(state.profile.cityId) ?? null : null;
  const zones = useMemo(() => (state && city ? buildZones(state.profile, city) : []), [state, city]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id as string, z])), [zones]);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    getForecast(city).then((f) => alive && setForecast(f));
    return () => {
      alive = false;
    };
  }, [city]);

  const derived = useMemo(() => {
    if (!state || !city) return null;
    const f = forecast ?? normalsForecast(city);
    const placements = state.plan.placements.filter((p) => enginePlantMap.has(p.plantId) && zoneMap.has(p.zoneId));
    const month = new Date().getMonth() + 1;
    const sunFits = placements.map((pl) => {
      const e = evaluate(enginePlantMap.get(pl.plantId)!, zoneMap.get(pl.zoneId)!, state.profile, city, month);
      return e.candidate?.sunFit ?? 0.3;
    });
    const impact = impactFor(placements, enginePlantMap, zones, state.profile, enginePlants, sunFits);
    return {
      forecast: f,
      placements,
      alerts: weatherAlerts(f, placements, enginePlantMap, zoneMap, state.profile),
      watering: todaysWatering(placements, enginePlantMap, zoneMap, f.days[0], state.watered),
      season: seasonCheck(placements, enginePlantMap, zones, state.profile, city, month),
      calendar: careCalendar(placements, enginePlantMap, city),
      impact,
      nature: natureStory(placements, enginePlantMap, impact, state.profile),
    };
  }, [state, city, forecast, zones, zoneMap]);

  const actions = useMemo(
    () => ({
      create(profile: SpaceProfile) {
        const g = planGarden(profile, null);
        saveGarden(g);
        setState(g);
      },
      replan(profile: SpaceProfile) {
        update((g) => planGarden(profile, g));
      },
      water(plantId: string) {
        update((g) => ({ ...g, watered: { ...g.watered, [plantId]: new Date().toISOString() } }));
      },
      waterAll(ids: string[]) {
        const now = new Date().toISOString();
        update((g) => ({ ...g, watered: { ...g.watered, ...Object.fromEntries(ids.map((id) => [id, now])) } }));
      },
      plantAll() {
        update((g) => ({ ...g, plan: { ...g.plan, placements: g.plan.placements.map((p) => ({ ...p, planted: true })) } }));
      },
      togglePlanted(plantId: string) {
        update((g) => ({
          ...g,
          plan: { ...g.plan, placements: g.plan.placements.map((p) => (p.plantId === plantId ? { ...p, planted: !p.planted } : p)) },
        }));
      },
      remove(plantId: string) {
        update((g) => ({
          ...g,
          removed: [...new Set([...g.removed, plantId])],
          plan: { ...g.plan, placements: g.plan.placements.filter((p) => p.plantId !== plantId) },
        }));
      },
      swap(plantId: string, withId: string) {
        update((g) => {
          const city = cityMap.get(g.profile.cityId)!;
          const zones = buildZones(g.profile, city);
          const old = g.plan.placements.find((p) => p.plantId === plantId);
          const z = zones.find((x) => x.id === old?.zoneId);
          const p = enginePlantMap.get(withId);
          if (!old || !z || !p) return g;
          const e = evaluate(p, z, g.profile, city, new Date().getMonth() + 1);
          if (!e.candidate) return g;
          const next: Placement = {
            ...old,
            plantId: withId,
            potL: e.candidate.potL,
            score: e.candidate.score,
            reasons: e.candidate.reasons,
            warnings: e.candidate.warnings,
            alternatives: [plantId, ...old.alternatives.filter((a) => a !== withId)].slice(0, 4),
            planted: false,
            owned: false,
            pinned: true,
            breakdown: e.candidate.breakdown,
          };
          return { ...g, plan: { ...g.plan, placements: g.plan.placements.map((x) => (x.plantId === plantId ? next : x)) } };
        });
      },
      move(plantId: string, toZone: string) {
        update((g) => {
          const city = cityMap.get(g.profile.cityId)!;
          const zones = buildZones(g.profile, city);
          const z = zones.find((x) => x.id === toZone);
          const p = enginePlantMap.get(plantId);
          if (!z || !p) return g;
          const e = evaluate(p, z, g.profile, city, new Date().getMonth() + 1);
          return {
            ...g,
            plan: {
              ...g.plan,
              placements: g.plan.placements.map((x) =>
                x.plantId === plantId
                  ? { ...x, zoneId: z.id, pinned: true, reasons: e.candidate?.reasons ?? x.reasons, warnings: e.candidate?.warnings ?? [], score: e.candidate?.score ?? x.score }
                  : x,
              ),
            },
          };
        });
      },
      /**
       * Add a plant. Returns why it doesn't fit (and does nothing) unless `force` is set, in which
       * case it goes in the best available spot with a clear warning.
       */
      add(plantId: string, toZone?: string, force = false): { ok: boolean; reason?: string } {
        const g = latest.current;
        if (!g) return { ok: false };
        const city = cityMap.get(g.profile.cityId)!;
        const zones = buildZones(g.profile, city);
        const p = enginePlantMap.get(plantId);
        const month = new Date().getMonth() + 1;
        if (!p || g.plan.placements.some((x) => x.plantId === plantId)) return { ok: false, reason: "Already in your garden." };
        const pool = zones.filter((z) => !toZone || z.id === toZone);
        let c = pool.map((z) => evaluate(p, z, g.profile, city, month).candidate).filter((x) => !!x).sort((a, b) => b.score - a.score)[0];
        if (!c) {
          const reason = whyNot(p, pool, g.profile, city, month) ?? "It doesn't fit any spot.";
          if (!force) return { ok: false, reason };
          c = pool.map((z) => evaluate(p, z, g.profile, city, month, true).candidate).filter((x) => !!x).sort((a, b) => b.score - a.score)[0];
          if (!c) {
            // Last resort: the sunniest spot whose type suits the plant.
            const z = [...pool].sort((a, b) => b.sunByMonth[month - 1] - a.sunByMonth[month - 1]).find((x) => p.zones.includes(x.dataZone) || x.dataZone === "floor");
            if (!z) return { ok: false, reason };
            const pl: Placement = {
              plantId, zoneId: z.id, potL: p.min_pot_l, score: 0, reasons: ["Added by you"], warnings: [`Not an ideal match: ${reason}`],
              alternatives: [], planted: false, owned: false, pinned: true,
            };
            update((st) => ({ ...st, plan: { ...st.plan, placements: [...st.plan.placements, pl] } }));
            return { ok: true, reason };
          }
          c = { ...c, warnings: [`Added by you. ${reason}`, ...c.warnings] };
        }
        const pl: Placement = {
          plantId,
          zoneId: c.zone.id,
          potL: c.potL,
          score: c.score,
          reasons: c.reasons,
          warnings: c.warnings,
          breakdown: c.breakdown,
          alternatives: [],
          planted: false,
          owned: false,
          pinned: true,
        };
        update((st) => ({ ...st, removed: st.removed.filter((r) => r !== plantId), plan: { ...st.plan, placements: [...st.plan.placements, pl] } }));
        return { ok: true };
      },
    }),
    [update],
  );

  return { loaded, state, city, zones, zoneMap, derived, actions };
}
