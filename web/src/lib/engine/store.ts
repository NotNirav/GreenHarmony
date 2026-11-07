import { DEFAULT_PROFILE, type SpaceProfile } from "../space/types";
import type { Plan } from "./types";

/** Everything about the user's living garden, saved on this device. */
export interface GardenState {
  v: 1;
  profile: SpaceProfile;
  plan: Plan;
  /** plantId → ISO timestamp of last watering. */
  watered: Record<string, string>;
  /** Plants the user removed; the planner won't suggest them again. */
  removed: string[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "gh:garden:v1";

export function loadGarden(): GardenState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GardenState;
    if (g.v !== 1 || !g.profile || !g.plan) return null;
    return { ...g, profile: { ...DEFAULT_PROFILE, ...g.profile } };
  } catch {
    return null;
  }
}

export function saveGarden(g: GardenState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...g, updatedAt: new Date().toISOString() }));
  } catch {
    /* storage blocked (private mode): the page still works for this visit */
  }
}

export function clearGarden(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Compact, URL-safe encoding of a space profile for share links. */
export function encodeProfile(p: SpaceProfile): string {
  const json = JSON.stringify(p);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeProfile(s: string): SpaceProfile | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (p?.v !== 1) return null;
    return { ...DEFAULT_PROFILE, ...p };
  } catch {
    return null;
  }
}
