import { insights } from "./client-data";
import type { Insight, InsightContext } from "./types";

/** Insights valid for a context in a given month (seasonal ones only show in their months). */
export function poolFor(context: InsightContext, month: number, category?: string): Insight[] {
  return insights.filter(
    (i) =>
      i.contexts.includes(context) &&
      (i.months.length === 0 || i.months.includes(month)) &&
      (!category || i.category === category),
  );
}

/** Deterministic pick so server HTML and the first client render match. */
export function stablePick(pool: Insight[], seed: string): Insight {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/** Fisher–Yates shuffle that puts in-season insights first, so they surface more often. */
export function shuffledDeck(pool: Insight[], month: number): Insight[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const seasonal = arr.filter((i) => i.months.includes(month));
  return [...seasonal.slice(0, 3), ...arr.filter((i) => !seasonal.slice(0, 3).includes(i))];
}

const SEEN_KEY = "gh:seen-insights";

export function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function markSeen(id: string): void {
  try {
    const seen = readSeen();
    seen.add(id);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-120)));
  } catch {
    /* storage unavailable: rotation still works, just may repeat */
  }
}

/** Random unseen insight for one-off spots (empty states, transition toasts). */
export function randomInsight(context: InsightContext, month: number): Insight {
  const pool = poolFor(context, month);
  const seen = readSeen();
  const fresh = pool.filter((i) => !seen.has(i.id));
  const list = fresh.length ? fresh : pool;
  const pick = list[Math.floor(Math.random() * list.length)];
  markSeen(pick.id);
  return pick;
}
