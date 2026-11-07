import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPlantById, lite, plants, stats } from "@/lib/data";
import { CATEGORY_LABEL, ZONE_LABEL, sunHours } from "@/lib/labels";
import type { Category, Zone } from "@/lib/types";
import { PlantImage } from "@/components/plants/PlantImage";
import { PlantRail } from "@/components/plants/PlantRail";
import { InSeasonNow } from "@/components/plants/InSeasonNow";
import { InsightTicker } from "@/components/insights/InsightTicker";
import { SectionHeader } from "@/components/SectionHeader";
import { GardenCta } from "@/components/GardenCta";
import { SpatialTeaser } from "@/components/space/SpatialTeaser";
import citiesJson from "@/data/cities.json";
import { DEMO_PROFILE, type City } from "@/lib/space/types";
import { buildZones } from "@/lib/space/zones";
import { buildPlan } from "@/lib/engine/recommend";
import { impactFor } from "@/lib/engine/impact";
import { natureStory } from "@/lib/engine/nature";
import type { EnginePlant } from "@/lib/engine/types";
import enginePlantsJson from "@/data/plants_engine.json";

const enginePlants = enginePlantsJson as unknown as EnginePlant[];

// Only Pune's record is passed to the client teaser, not the whole climate file.
const pune = (citiesJson as unknown as City[]).find((c) => c.id === "pune")!;

/** Run the real planner on the deck's demo balcony (fixed month so the build is reproducible). */
function demoStory() {
  const zones = buildZones(DEMO_PROFILE, pune);
  const plan = buildPlan(enginePlants, zones, DEMO_PROFILE, pune, { month: 10 });
  const byId = new Map(enginePlants.map((p) => [p.id, p]));
  const impact = impactFor(plan.placements, byId, zones, DEMO_PROFILE, enginePlants, plan.placements.map(() => 1));
  return natureStory(plan.placements, byId, impact, DEMO_PROFILE);
}
const demo = demoStory();

const SPACES: { zone: Zone; plant: string; hint: string }[] = [
  { zone: "railing", plant: "marigold", hint: "Balcony edge planters" },
  { zone: "windowsill", plant: "aloe_vera", hint: "Small pots, bright window" },
  { zone: "hanging", plant: "aparajita", hint: "Baskets that spill over" },
  { zone: "wall", plant: "madhumalti", hint: "Climbers on grills" },
  { zone: "floor", plant: "lemon", hint: "Big pots & grow bags" },
  { zone: "indoor", plant: "money_plant", hint: "Low light, inside" },
];

export default function Home() {
  const hero = getPlantById("hibiscus")!;
  const chip = getPlantById("tulsi")!;
  const favourites = plants.filter((p) => p.popularity === 5).slice(0, 6).map(lite);
  const categories = (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
    c,
    cover: plants.find((p) => p.category === c && p.photo?.commercial_ok) ?? plants.find((p) => p.category === c)!,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-20 px-4 md:space-y-28 md:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pt-16">
        <div>
          <p className="text-sm font-semibold text-accent">For Indian balconies, terraces & windowsills</p>
          <h1 className="mt-4 text-balance text-[2.75rem] font-extrabold leading-[1] tracking-[-0.035em] md:text-7xl">
            Grow a garden that suits your space
          </h1>
          <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted">
            Plants that actually thrive in your sunlight, water and space — all sold at your local nursery, with names you
            know: <span className="font-deva text-ink-2">तुलसी, मोगरा, जास्वंद</span>.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <GardenCta className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg transition hover:opacity-85" />
            <Link href="/plants/" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold">
              Browse {stats.plants} plants
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <dl className="mt-12 flex divide-x divide-line text-sm">
            {[
              [stats.plants, "plants"],
              [stats.beginner_friendly, "beginner-easy"],
              [stats.edible, "you can eat"],
            ].map(([v, k], i) => (
              <div key={k} className={i === 0 ? "pr-6" : "px-6"}>
                <dd className="text-2xl font-extrabold tracking-tight">{v}</dd>
                <dt className="text-muted">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <Link href={`/plants/${hero.slug}/`} className="block overflow-hidden rounded-[28px]">
            <PlantImage
              src={hero.photo?.large_url}
              name={hero.common_name}
              botanical={hero.botanical_name}
              priority
              className="aspect-[4/5] w-full md:aspect-[5/6]"
            />
          </Link>
          <Link
            href={`/plants/${chip.slug}/`}
            className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-overlay p-2.5 pr-5 shadow-float backdrop-blur-xl transition hover:-translate-y-0.5 md:-left-8 md:bottom-10"
          >
            <PlantImage src={chip.photo?.thumb_url} name={chip.common_name} botanical={chip.botanical_name} className="size-14 rounded-xl" />
            <span>
              <span className="block text-sm font-bold">
                Tulsi <span className="font-deva font-medium text-muted">तुलसी</span>
              </span>
              <span className="block text-xs text-muted">{sunHours(chip.sun_min_hrs, chip.sun_max_hrs)} · {chip.water} water</span>
              <span className="mt-1 inline-block text-xs font-semibold text-accent">Easy · in every nursery</span>
            </span>
          </Link>
        </div>
      </section>

      <InsightTicker context="tip" seed="home" />

      <section>
        <SectionHeader title="India's favourite plants" sub="The bestsellers at Indian nurseries — and why people love them." href="/plants/" />
        <PlantRail plants={favourites} />
      </section>

      {/* Spaces */}
      <section>
        <SectionHeader title="What space do you have?" sub="Use every layer of your balcony." />
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 md:mx-0 md:grid md:grid-cols-6 md:gap-4 md:px-0">
          {SPACES.map(({ zone, plant, hint }) => {
            const p = getPlantById(plant)!;
            const count = plants.filter((x) => x.zones.includes(zone)).length;
            return (
              <li key={zone} className="w-[38vw] max-w-[180px] shrink-0 snap-start md:w-auto md:max-w-none">
                <Link href={`/plants/?zone=${zone}`} className="group relative block overflow-hidden rounded-2xl">
                  <PlantImage
                    src={p.photo?.url}
                    name={p.common_name}
                    botanical={p.botanical_name}
                    className="aspect-[3/4] w-full transition duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
                  <span className="absolute inset-x-3 bottom-3 text-white">
                    <span className="block text-[15px] font-bold leading-tight">{ZONE_LABEL[zone]}</span>
                    <span className="block text-xs text-white/80">{hint}</span>
                    <span className="mt-1 block text-xs font-semibold text-white/90">{count} plants</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <SpatialTeaser city={pune} />

      <InSeasonNow />

      {/* Mission: every pot counts */}
      <section className="border-t border-line pt-14 md:pt-20">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <div>
            <p className="text-sm font-semibold text-accent">Every pot counts</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
              One balcony is small. Thousands of balconies are an urban forest.
            </h2>
            <p className="mt-5 max-w-md text-pretty text-muted md:text-lg">
              Cities are getting hotter and greener spaces are shrinking. You don&apos;t need a garden to help: a balcony, a railing,
              even a windowsill can cool a wall, feed bees and grow food. GreenHarmony exists to make each of those small acts
              succeed, and to show how they add up.
            </p>
          </div>
          <dl className="divide-y divide-line self-end">
            {[
              ["1–7 °C", "cooler local air from shade and evapotranspiration"],
              ["Up to 80%", "of rainfall held back by some green-roof systems, easing flooded drains"],
              ["1 in 3", "bites of our food depends on pollinators like bees"],
            ].map(([v, t]) => (
              <div key={v} className="flex items-baseline gap-5 py-5 first:pt-0">
                <dd className="w-32 shrink-0 text-3xl font-extrabold tracking-tight md:text-4xl">{v}</dd>
                <dt className="text-sm text-muted">{t}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* Worked example from the real engine, not a slogan */}
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-subtle p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">One Pune balcony · 1.8 × 1.2 m</p>
            <p className="mt-3 text-4xl font-extrabold tracking-tight">{demo.plants} plants</p>
            <p className="mt-2 text-sm text-ink-2">
              {demo.greenM2} m² of green across floor, railing and wall, {demo.beeFriendly} bee-friendly plants, {demo.food} you can eat, and{" "}
              {demo.waterSavedLPerYear.toLocaleString("en-IN")} L of water saved a year.
            </p>
          </div>
          {demo.ripples.map((r) => (
            <div key={r.label} className="rounded-3xl bg-accent-soft p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">× {r.homes.toLocaleString("en-IN")} homes</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight">{r.greenM2.toLocaleString("en-IN")} m²</p>
              <p className="mt-2 text-sm text-ink-2">
                of new green, {r.beeFriendly.toLocaleString("en-IN")} bee-friendly plants, {r.waterSavedKL.toLocaleString("en-IN")} kL of water saved and
                ~{r.co2Tonnes[0]}–{r.co2Tonnes[1]} t CO₂ taken up a year.
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Worked out by our planner for the Indradhanu demo balcony. Estimates, not measurements, and real gardens vary.
        </p>
      </section>

      {/* Categories */}
      <section>
        <SectionHeader title="Browse by type" />
        <ul className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-8 md:px-0">
          {categories.map(({ c, cover }) => (
            <li key={c} className="shrink-0">
              <Link href={`/plants/?category=${c}`} className="group flex w-20 flex-col items-center gap-2 text-center md:w-auto">
                <span className="block size-20 overflow-hidden rounded-full ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent md:size-24">
                  <PlantImage src={cover.photo?.thumb_url} name={cover.common_name} botanical={cover.botanical_name} className="size-full" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">{CATEGORY_LABEL[c]}</span>
                <span className="-mt-1.5 text-xs text-muted">{stats.by_category[c] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
