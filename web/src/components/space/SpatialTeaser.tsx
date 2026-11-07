"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DEMO_PROFILE, type City, type Facing } from "@/lib/space/types";
import { SunHeatmap } from "./SunHeatmap";
import { MonthSlider } from "./MonthSlider";
import { FACING_LABEL, MONTHS_LONG } from "./labels";

const FACINGS: Facing[] = [0, 90, 180, 270];

/** Home-page demo of the sun model: change the facing and month and watch the light move. */
export function SpatialTeaser({ city }: { city: City }) {
  const [facing, setFacing] = useState<Facing>(180);
  const [month, setMonth] = useState(6);
  useEffect(() => {
    const id = setTimeout(() => setMonth(new Date().getMonth() + 1));
    return () => clearTimeout(id);
  }, []);
  const profile = { ...DEMO_PROFILE, facing, width: 2.4, depth: 1.5, frontView: "medium" as const };

  return (
    <section className="grid items-center gap-10 border-t border-line pt-14 md:grid-cols-[1fr_1.1fr] md:gap-16 md:pt-20">
      <div>
        <p className="text-sm font-semibold text-accent">Knows your balcony</p>
        <h2 className="mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">Sun moves. Your plan moves with it.</h2>
        <p className="mt-5 max-w-md text-pretty text-muted md:text-lg">
          We trace the sun&apos;s real path over your city through your balcony&apos;s railing, roof and walls, spot by spot and
          month by month. A south-facing balcony in {city.name} is bright in winter and almost sunless in June. We plan for that,
          and tell you when to move a pot.
        </p>
        <Link href="/plan/" className="group mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold">
          Map my balcony <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="rounded-[28px] bg-subtle p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold">
            {city.name} · {MONTHS_LONG[month - 1]}
          </p>
          <div className="flex gap-1.5">
            {FACINGS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFacing(f)}
                aria-pressed={f === facing}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${f === facing ? "bg-ink text-bg" : "bg-bg text-ink-2"}`}
              >
                {FACING_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <SunHeatmap profile={profile} city={city} month={month} className="mt-4" />
        <div className="mt-4">
          <MonthSlider month={month} onChange={setMonth} />
        </div>
      </div>
    </section>
  );
}
