import type { Facing } from "@/lib/space/types";

export const FACING_LABEL: Record<Facing, string> = {
  0: "North",
  45: "North-east",
  90: "East",
  135: "South-east",
  180: "South",
  225: "South-west",
  270: "West",
  315: "North-west",
};

export const FACING_SHORT: Record<Facing, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function sunWords(h: number): string {
  if (h >= 6) return "Full sun";
  if (h >= 3) return "Part sun";
  if (h >= 1) return "Bright shade";
  return "Shade";
}
