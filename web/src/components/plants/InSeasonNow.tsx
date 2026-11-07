"use client";

import { useEffect, useState } from "react";
import { plantIndex as plants } from "@/lib/client-data";
import { SectionHeader } from "../SectionHeader";
import { PlantRail } from "./PlantRail";

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Plants whose planting window includes the visitor's current month (computed client-side so it never goes stale). */
export function InSeasonNow() {
  const [month, setMonth] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setMonth(new Date().getMonth() + 1));
    return () => clearTimeout(id);
  }, []);

  if (month === null) return <div className="h-80" aria-hidden />;

  // Exclude evergreen "any month" houseplants so the list is genuinely seasonal.
  const list = plants
    .filter((p) => p.plant_months.includes(month) && p.plant_months.length < 12)
    .sort((a, b) => b.popularity - a.popularity || b.beginner_score - a.beginner_score)
    .slice(0, 6);

  return (
    <section>
      <SectionHeader title={`Plant this ${FULL_MONTHS[month - 1]}`} sub="The right season for these across most of India." href="/plants/" />
      <PlantRail plants={list} />
    </section>
  );
}
