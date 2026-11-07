"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { insights } from "@/lib/client-data";
import { INSIGHT_CATEGORY_LABEL, MONTHS } from "@/lib/labels";
import type { Insight } from "@/lib/types";

// Empty-state lines are UI copy, not tips worth browsing.
const BROWSABLE = insights.filter((i) => !(i.contexts.length === 1 && i.contexts[0] === "empty"));
const CATEGORIES = Object.keys(INSIGHT_CATEGORY_LABEL).filter((c) => BROWSABLE.some((i) => i.category === c));

function dayOfYear(d: Date) {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

export function InsightsBrowser() {
  const [category, setCategory] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [featured, setFeatured] = useState<Insight>(BROWSABLE[0]);

  useEffect(() => {
    const id = setTimeout(() => {
      const now = new Date();
      const m = now.getMonth() + 1;
      setMonth(m);
      const pool = BROWSABLE.filter((i) => i.months.length === 0 || i.months.includes(m));
      setFeatured(pool[dayOfYear(now) % pool.length]);
    });
    return () => clearTimeout(id);
  }, []);

  const list = useMemo(
    () =>
      BROWSABLE.filter((i) => !category || i.category === category).sort((a, b) => {
        // In-season tips first, then evergreen, then out-of-season ones.
        const rank = (i: Insight) => (i.months.length === 0 ? 1 : month && i.months.includes(month) ? 0 : 2);
        return rank(a) - rank(b);
      }),
    [category, month],
  );

  function another() {
    const pool = BROWSABLE.filter((i) => i.id !== featured.id && (i.months.length === 0 || (month && i.months.includes(month))));
    setFeatured(pool[Math.floor(Math.random() * pool.length)]);
  }

  const featuredPlant = featured.plant_links[0];

  return (
    <div className="mt-10 md:mt-14">
      <section className="border-y border-line py-10 md:py-14">
        <p className="text-sm font-semibold text-warm">Tip of the day</p>
        <p key={featured.id} className="animate-fade-up mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-[1.15] tracking-tight md:text-[2.75rem]">
          {featured.text}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            onClick={another}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-85"
          >
            <RefreshCw className="size-4" aria-hidden /> Another tip
          </button>
          {featuredPlant && (
            <Link href={`/plants/${featuredPlant.slug}/`} className="inline-flex items-center gap-0.5 text-sm font-semibold hover:underline">
              About {featuredPlant.name} <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>

      <div className="no-scrollbar sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-4 backdrop-blur-xl md:top-16 md:mx-0 md:flex-wrap md:px-0">
        {[null, ...CATEGORIES].map((c) => {
          const active = category === c;
          return (
            <button
              key={c ?? "all"}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-ink text-bg" : "bg-subtle text-ink-2 hover:bg-subtle-2"
              }`}
            >
              {c ? INSIGHT_CATEGORY_LABEL[c] : "All"}
            </button>
          );
        })}
      </div>

      <ul className="grid gap-x-12 md:grid-cols-2">
        {list.map((i) => {
          const plant = i.plant_links[0];
          const inSeason = i.months.length > 0 && month !== null && i.months.includes(month);
          return (
            <li key={i.id} className="border-b border-line py-5">
              <p className="text-pretty text-[17px] leading-relaxed">{i.text}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                <span>{INSIGHT_CATEGORY_LABEL[i.category]}</span>
                {i.months.length > 0 && (
                  <span className={inSeason ? "font-semibold text-warm" : ""}>
                    {inSeason ? "In season now" : i.months.map((m) => MONTHS[m - 1]).join(", ")}
                  </span>
                )}
                {plant && (
                  <Link href={`/plants/${plant.slug}/`} className="inline-flex items-center gap-0.5 font-semibold text-ink hover:underline">
                    {plant.name} <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
