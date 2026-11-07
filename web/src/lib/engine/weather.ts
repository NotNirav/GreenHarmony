import type { City } from "../space/types";

export interface DayForecast {
  date: string;
  tmax: number;
  tmin: number;
  rain: number;
  rainProb: number;
  wind: number;
  uv: number;
}

export interface Forecast {
  source: "live" | "normals";
  fetchedAt: string;
  current: { temp: number; rh: number; rain: number } | null;
  days: DayForecast[];
}

const TTL_MS = 3 * 60 * 60 * 1000;
const key = (cityId: string) => `gh:forecast:${cityId}`;

/** Climate-normal "forecast" used offline or when the live API fails. */
export function normalsForecast(city: City, start = new Date()): Forecast {
  const days: DayForecast[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    const m = city.months[d.getMonth()];
    return {
      date: d.toISOString().slice(0, 10),
      tmax: m.tmax,
      tmin: m.tmin,
      rain: Math.round((m.rain_mm / 30) * 10) / 10,
      rainProb: Math.round(Math.min(100, (m.rainy_days / 30) * 100)),
      wind: m.wind_max,
      uv: 0,
    };
  });
  return { source: "normals", fetchedAt: new Date().toISOString(), current: null, days };
}

function readCache(cityId: string): Forecast | null {
  try {
    const raw = localStorage.getItem(key(cityId));
    if (!raw) return null;
    const f = JSON.parse(raw) as Forecast;
    return Date.now() - new Date(f.fetchedAt).getTime() < TTL_MS ? f : null;
  } catch {
    return null;
  }
}

/** Live 7-day forecast from Open-Meteo (free, no key), cached for 3 hours; falls back to normals. */
export async function getForecast(city: City): Promise<Forecast> {
  const cached = readCache(city.id);
  if (cached) return cached;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max" +
      "&current=temperature_2m,relative_humidity_2m,precipitation&timezone=Asia%2FKolkata&forecast_days=7";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const d = j.daily;
    const f: Forecast = {
      source: "live",
      fetchedAt: new Date().toISOString(),
      current: j.current
        ? { temp: j.current.temperature_2m, rh: j.current.relative_humidity_2m, rain: j.current.precipitation }
        : null,
      days: d.time.map((date: string, i: number) => ({
        date,
        tmax: d.temperature_2m_max[i],
        tmin: d.temperature_2m_min[i],
        rain: d.precipitation_sum[i] ?? 0,
        rainProb: d.precipitation_probability_max?.[i] ?? 0,
        wind: d.wind_speed_10m_max[i] ?? 0,
        uv: d.uv_index_max?.[i] ?? 0,
      })),
    };
    try {
      localStorage.setItem(key(city.id), JSON.stringify(f));
    } catch {
      /* storage full or blocked: still return the live data */
    }
    return f;
  } catch {
    return normalsForecast(city);
  }
}
