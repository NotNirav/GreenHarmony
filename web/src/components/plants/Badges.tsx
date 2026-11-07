import { Droplet, Moon, Sun, SunDim } from "lucide-react";
import type { Level, SunClass } from "@/lib/types";

const SUN_SHORT: Record<SunClass, string> = { full_sun: "Full sun", partial_sun: "Part sun", shade: "Shade" };
const WATER_SHORT: Record<Level, string> = { low: "Low water", medium: "Some water", high: "Thirsty" };

/** Quiet one-line care summary: icon + words, no coloured pills. */
export function CareMeta({ sun, water, className = "" }: { sun: SunClass; water: Level; className?: string }) {
  const SunIcon = sun === "full_sun" ? Sun : sun === "partial_sun" ? SunDim : Moon;
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted ${className}`}>
      <span className="inline-flex items-center gap-1">
        <SunIcon className="size-3.5" aria-hidden />
        {SUN_SHORT[sun]}
      </span>
      <span className="inline-flex items-center gap-1">
        <Droplet className="size-3.5" aria-hidden />
        {WATER_SHORT[water]}
      </span>
    </p>
  );
}
