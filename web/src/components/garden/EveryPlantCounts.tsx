"use client";

import { useState } from "react";
import { Check, Droplets, Flower, Flower2, Leaf, Lock, Share2, Sprout, Utensils } from "lucide-react";
import type { NatureStory } from "@/lib/engine/nature";

/** The mission, made personal: what this garden gives back, and what it adds up to. */
export function EveryPlantCounts({ story, cityName, gardenName }: { story: NatureStory; cityName: string; gardenName: string }) {
  const [shared, setShared] = useState(false);
  const done = story.milestones.filter((m) => m.done).length;
  const share = async () => {
    const text = `${gardenName || "My balcony"} in ${cityName}: ${story.plants} plants, ${story.greenM2} m² of new green and ${story.beeFriendly} bee-friendly plants. Every plant counts. 🌱 #EveryPlantCounts`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  const stats = [
    { icon: Leaf, v: `${story.greenM2} m²`, t: "of green across floor, railing and wall" },
    { icon: Flower, v: `${story.beeFriendly}`, t: "plants feeding bees and butterflies" },
    { icon: Utensils, v: `${story.food}`, t: "plants you can eat" },
    { icon: Droplets, v: `${story.waterSavedLPerYear.toLocaleString("en-IN")} L`, t: "water saved a year vs a thirsty mix" },
  ];

  return (
    <section className="border-t border-line pt-10 md:pt-14">
      <p className="text-sm font-semibold text-accent">Every plant counts</p>
      <h2 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
        Your {story.plants} plants give back to {cityName}, and it adds up.
      </h2>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
        {stats.map(({ icon: Icon, v, t }) => (
          <div key={t}>
            <Icon className="size-5 text-accent" aria-hidden />
            <dd className="mt-2 text-3xl font-extrabold tracking-tight">{v}</dd>
            <dt className="text-sm text-muted">{t}</dt>
          </div>
        ))}
      </dl>

      {/* Ripple effect */}
      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {story.ripples.map((r) => (
          <div key={r.label} className="rounded-3xl bg-accent-soft p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">If {r.label} did the same</p>
            <p className="mt-2 text-pretty text-lg font-bold leading-snug">
              {r.greenM2.toLocaleString("en-IN")} m² of new green, {r.beeFriendly.toLocaleString("en-IN")} bee-friendly plants and{" "}
              {r.waterSavedKL.toLocaleString("en-IN")} kL of water saved every year.
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Roughly {r.co2Tonnes[0]}–{r.co2Tonnes[1]} t of CO₂ taken up a year, plus cooler walls and fewer flooded drains.
            </p>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold">
              Milestones · {done} of {story.milestones.length}
            </p>
            <p className="text-xs text-muted">They unlock as you mark plants as planted ({story.planted} so far).</p>
          </div>
          <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
            {shared ? <Check className="size-4" /> : <Share2 className="size-4" />} {shared ? "Copied" : "Share #EveryPlantCounts"}
          </button>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {story.milestones.map((m) => (
            <li
              key={m.id}
              title={m.done ? m.text : m.hint}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${m.done ? "bg-accent text-bg" : "bg-subtle text-muted"}`}
            >
              {m.done ? <MilestoneIcon id={m.id} /> : <Lock className="size-3.5" />}
              {m.title}
              {!m.done && <span className="font-normal">· {m.hint.toLowerCase()}</span>}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-xs text-muted">
        Estimates from plant size, water needs and pollinator value in our dataset. Real numbers depend on how your plants grow.
      </p>
    </section>
  );
}

function MilestoneIcon({ id }: { id: string }) {
  const Icon = id === "bees" ? Flower : id === "kitchen" ? Utensils : id === "water" ? Droplets : id === "pooja" ? Flower2 : id === "sprout" ? Sprout : Leaf;
  return <Icon className="size-4" aria-hidden />;
}
