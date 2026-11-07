"use client";

import { useState } from "react";
import type { City, SpaceProfile, Zone } from "@/lib/space/types";
import { SunStudio } from "./SunStudio";
import { SunHeatmap } from "./SunHeatmap";
import { MonthSlider } from "./MonthSlider";

/** Two ways to see the sun model: watch a day play out, or the daily total per spot. */
export function SunPanel({ profile, city, zones, onMonth }: { profile: SpaceProfile; city: City; zones: Zone[]; onMonth?: (m: number) => void }) {
  const [tab, setTab] = useState<"day" | "total">("day");
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const pick = (m: number) => {
    setMonth(m);
    onMonth?.(m);
  };
  return (
    <div>
      <div className="inline-flex rounded-full bg-subtle p-1 text-sm font-semibold" role="tablist">
        {(
          [
            ["day", "Through the day"],
            ["total", "Daily total"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 transition-colors ${tab === k ? "bg-ink text-bg" : "text-ink-2"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "day" ? (
          <SunStudio profile={profile} city={city} zones={zones} initialMonth={month} />
        ) : (
          <div className="space-y-4">
            <SunHeatmap profile={profile} city={city} month={month} />
            <MonthSlider month={month} onChange={pick} />
          </div>
        )}
      </div>
    </div>
  );
}
