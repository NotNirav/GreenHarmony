"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CloudRain,
  Droplets,
  Leaf,
  Pencil,
  RefreshCw,
  Share2,
  Sprout,
  Sun,
  ThermometerSun,
  TriangleAlert,
  Wind,
  X,
} from "lucide-react";
import { useGarden } from "@/lib/engine/useGarden";
import { enginePlantMap, enginePlants } from "@/lib/engine/data";
import { EXCLUDE_LABEL } from "@/lib/engine/recommend";
import { clearGarden, decodeProfile, encodeProfile } from "@/lib/engine/store";
import { inr } from "@/lib/labels";
import { searchPlants } from "@/lib/search";
import type { EnginePlant } from "@/lib/engine/types";
import { LayoutView } from "../space/LayoutView";
import { SunPanel } from "../space/SunPanel";
import { FACING_LABEL, MONTHS_LONG, MONTHS_SHORT } from "../space/labels";
import { InsightTicker } from "../insights/InsightTicker";
import { InsightLoader } from "../insights/InsightLoader";
import { PlantImage } from "../plants/PlantImage";
import { EveryPlantCounts } from "./EveryPlantCounts";
import { InstallApp } from "../InstallApp";
import { HowWeChoose, ScoreBreakdown } from "./ScoreBreakdown";

const name = (p: EnginePlant) => p.common_name.split(" (")[0];

function Section({ id, title, sub, children, action }: { id?: string; title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10 md:pt-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h2>
          {sub && <p className="mt-1.5 text-sm text-muted md:text-base">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function GardenDashboard() {
  const { loaded, state, city, zones, zoneMap, derived, actions } = useGarden();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [scoreFor, setScoreFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  // A shared link (?s=...) opens a garden preview the user can adopt.
  useEffect(() => {
    const id = setTimeout(() => setShared(new URLSearchParams(window.location.search).get("s")));
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!loaded || !shared) return;
    const p = decodeProfile(shared);
    if (p && (!state || confirm("Open the shared balcony? This replaces the garden saved on this device."))) actions.create(p);
    window.history.replaceState(null, "", window.location.pathname);
    const id = setTimeout(() => setShared(null));
    return () => clearTimeout(id);
  }, [loaded, shared, state, actions]);

  const thisMonth = new Date().getMonth() + 1;
  const selectedPlant = selected ? enginePlantMap.get(selected) : undefined;

  const shopping = useMemo(() => {
    if (!derived) return null;
    const ps = derived.placements.filter((pl) => !pl.planted && !pl.owned);
    const pots = new Map<number, number>();
    let soil = 0;
    let min = 0;
    let max = 0;
    for (const pl of ps) {
      const p = enginePlantMap.get(pl.plantId)!;
      pots.set(pl.potL, (pots.get(pl.potL) ?? 0) + 1);
      soil += pl.potL;
      min += p.price_inr_min;
      max += p.price_inr_max;
    }
    return { count: ps.length, pots: [...pots.entries()].sort((a, b) => a[0] - b[0]), soil: Math.ceil(soil * 0.9), min, max };
  }, [derived]);

  if (!loaded) return <InsightLoader label="Opening your garden" />;

  if (!state || !city || !derived) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 text-center md:pt-24">
        <Sprout className="mx-auto size-10 text-accent" aria-hidden />
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Your garden lives here</h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-lg text-muted">
          Describe your balcony once. We&apos;ll work out where the sun lands in every season, pick plants for each spot, and keep
          the plan updated with your city&apos;s weather.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <Link href="/plan/" className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
            Plan my space
          </Link>
          <Link href="/plan/?demo=1" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold">
            Try the Pune demo <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    );
  }

  const p = state.profile;
  const f = derived.forecast;
  const today = f.days[0];
  const due = derived.watering.filter((w) => w.status === "due");
  const notPlanted = derived.placements.filter((x) => !x.planted).length;
  const share = async () => {
    const url = `${window.location.origin}/garden/?s=${encodeProfile(p)}`;
    try {
      if (navigator.share) await navigator.share({ title: "My GreenHarmony balcony", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-accent">My garden</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {p.gardenName || `${{ balcony: "Balcony", terrace: "Terrace", windowsill: "Windowsill", indoor: "Indoor corner" }[p.kind]} in ${city.name.split(" (")[0]}`}
          </h1>
          <p className="mt-3 text-muted">
            {p.width.toFixed(1)} × {p.depth.toFixed(1)} m · faces {FACING_LABEL[p.facing].toLowerCase()} ·{" "}
            {p.floor === 0 ? "ground floor" : `floor ${p.floor}`} · {derived.placements.length} plants
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/plan/?edit=1" className="inline-flex items-center gap-2 rounded-full bg-subtle px-4 py-2.5 text-sm font-semibold hover:bg-subtle-2">
            <Pencil className="size-4" /> Edit space
          </Link>
          <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full bg-subtle px-4 py-2.5 text-sm font-semibold hover:bg-subtle-2">
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />} {copied ? "Link copied" : "Share"}
          </button>
          <button
            type="button"
            onClick={() => actions.replan(p)}
            className="inline-flex items-center gap-2 rounded-full bg-subtle px-4 py-2.5 text-sm font-semibold hover:bg-subtle-2"
            title="Re-run the planner, keeping plants you've marked as planted"
          >
            <RefreshCw className="size-4" /> Re-plan
          </button>
        </div>
      </header>

      <div className="mt-6 max-w-xl empty:hidden">
        <InstallApp />
      </div>

      {/* Today */}
      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-14">
        <section>
          <p className="text-sm font-semibold text-warm">
            Today in {city.name.split(" (")[0]}
            <span className="ml-2 font-normal text-muted">{f.source === "live" ? "live forecast" : "typical weather (offline)"}</span>
          </p>
          <div className="mt-3 flex items-end gap-6">
            <p className="text-6xl font-extrabold tracking-tighter">{Math.round(f.current?.temp ?? today.tmax)}°</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pb-2 text-sm">
              <dt className="text-muted">High / low</dt>
              <dd className="font-semibold">
                {Math.round(today.tmax)}° / {Math.round(today.tmin)}°
              </dd>
              <dt className="text-muted">Rain</dt>
              <dd className="font-semibold">{today.rain} mm</dd>
              <dt className="text-muted">Wind</dt>
              <dd className="font-semibold">{Math.round(today.wind)} km/h</dd>
            </dl>
          </div>
          <div className="mt-5 flex gap-1.5">
            {f.days.map((d, i) => (
              <div key={d.date} className="flex-1 rounded-xl bg-subtle px-1 py-2 text-center">
                <p className="text-[11px] font-semibold text-muted">{i === 0 ? "Today" : new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                <p className="mt-1 text-sm font-bold">{Math.round(d.tmax)}°</p>
                <p className="text-[11px] text-sky">{d.rain >= 1 ? `${Math.round(d.rain)}mm` : "–"}</p>
              </div>
            ))}
          </div>
          {derived.alerts.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {derived.alerts.map((a) => {
                const Icon = a.id === "heat" || a.id === "uv" ? ThermometerSun : a.id === "rain" ? CloudRain : a.id === "wind" ? Wind : TriangleAlert;
                return (
                  <li key={a.id} className={`flex gap-3 rounded-2xl p-4 ${a.level === "warn" ? "bg-warm-soft" : "bg-subtle"}`}>
                    <Icon className={`mt-0.5 size-5 shrink-0 ${a.level === "warn" ? "text-warm" : "text-sky"}`} />
                    <div>
                      <p className="font-bold">{a.title}</p>
                      <p className="mt-1 text-sm text-ink-2">{a.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted">
              <Check className="size-4 text-accent" /> No weather worries for your plants this week.
            </p>
          )}
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky">Watering today</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">
                {notPlanted === derived.placements.length
                  ? "Nothing planted yet"
                  : due.length
                    ? `${due.length} plant${due.length > 1 ? "s" : ""} need water`
                    : "All watered"}
              </p>
            </div>
            {due.length > 1 && (
              <button type="button" onClick={() => actions.waterAll(due.map((d) => d.plantId))} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
                Watered all
              </button>
            )}
          </div>
          {notPlanted > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-subtle p-4 text-sm">
              <p className="text-ink-2">
                {notPlanted === derived.placements.length
                  ? "Your watering schedule starts once plants are in pots. Mark them planted as you buy them."
                  : `${notPlanted} plant${notPlanted > 1 ? "s" : ""} not planted yet.`}
              </p>
              <button type="button" onClick={() => actions.plantAll()} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bg">
                I&apos;ve planted them all
              </button>
            </div>
          )}
          <ul className="mt-4 divide-y divide-line">
            {derived.watering.map((w) => {
              const pl = enginePlantMap.get(w.plantId)!;
              return (
                <li key={w.plantId} className="flex items-center gap-3 py-3">
                  <PlantImage src={pl.photo?.thumb_url} name={pl.common_name} botanical={pl.botanical_name} className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name(pl)}</p>
                    <p className="truncate text-xs text-muted">
                      {zoneMap.get(w.zoneId)?.label} · {w.note}
                    </p>
                  </div>
                  {w.status === "due" ? (
                    <button type="button" onClick={() => actions.water(w.plantId)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky/10 px-3 py-1.5 text-xs font-semibold text-sky">
                      <Droplets className="size-3.5" /> ~{w.litres} L
                    </button>
                  ) : w.status === "skip_rain" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-sky">
                      <CloudRain className="size-3.5" /> Skip
                    </span>
                  ) : (
                    <Check className="size-4 shrink-0 text-accent" aria-label="Watered" />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-14">
        <EveryPlantCounts story={derived.nature} cityName={city.name.split(" (")[0]} gardenName={p.gardenName} />
      </div>

      {/* Season check */}
      {derived.season.length > 0 && (
        <Section title="Season check" sub={`The sun's path shifts every month. Here's what that means for your plants in ${MONTHS_LONG[thisMonth - 1]}.`}>
          <ul className="grid gap-3 md:grid-cols-2">
            {derived.season.map((a, i) => {
              const pl = enginePlantMap.get(a.plantId)!;
              return (
                <li key={i} className="flex gap-4 rounded-2xl bg-subtle p-4">
                  <PlantImage src={pl.photo?.thumb_url} name={pl.common_name} botanical={pl.botanical_name} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-warm">
                      {a.kind === "move" ? "Move" : a.kind === "add" ? "Room to grow" : a.kind === "low_sun" ? "Less sun ahead" : "Too much sun"}
                    </p>
                    <p className="mt-1 text-sm text-ink-2">{a.text}</p>
                    {a.kind === "move" && a.toZone && (
                      <button type="button" onClick={() => actions.move(a.plantId, a.toZone!)} className="mt-3 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-bg">
                        Move it
                      </button>
                    )}
                    {a.kind === "add" && (
                      <button type="button" onClick={() => actions.add(a.plantId, a.toZone)} className="mt-3 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-bg">
                        Add to my garden
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Space */}
      <Section title="Your space" sub="Each layer of your space, top to bottom, with the sun it gets and the plants in it.">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <LayoutView
              profile={p}
              zones={zones}
              placements={derived.placements}
              plants={enginePlantMap}
              month={month}
              selected={selected}
              onSelect={setSelected}
              onAddClick={() => document.getElementById("add-plant")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
            {selectedPlant ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-subtle p-3">
                <PlantImage src={selectedPlant.photo?.thumb_url} name={selectedPlant.common_name} botanical={selectedPlant.botanical_name} className="size-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{name(selectedPlant)}</p>
                  <p className="text-xs text-muted">{zoneMap.get(derived.placements.find((x) => x.plantId === selectedPlant.id)?.zoneId ?? "")?.label}</p>
                </div>
                <a href={`#plant-${selectedPlant.id}`} className="text-sm font-semibold underline underline-offset-4">
                  Details
                </a>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="grid size-8 place-items-center rounded-full">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-muted">Tap a plant to see where it is and why it&apos;s there.</p>
            )}
          </div>
          <div>
            <p className="text-sm font-bold">How the sun moves through your space</p>
            <p className="mb-4 text-xs text-muted">Press play to watch a day, or switch to the daily total. Computed for {city.name.split(" (")[0]}&apos;s real sun path.</p>
            <SunPanel profile={p} city={city} zones={zones} onMonth={setMonth} />
          </div>
        </div>
      </Section>

      {/* Plants */}
      <Section title="Your plants" sub="Chosen for each spot. Mark them planted as you go; swap anything you don't like.">
        <ul className="grid gap-x-10 md:grid-cols-2">
          {derived.placements.map((pl) => {
            const pp = enginePlantMap.get(pl.plantId)!;
            const z = zoneMap.get(pl.zoneId)!;
            const swapping = swapFor === pl.plantId;
            return (
              <li key={pl.plantId} id={`plant-${pp.id}`} className="scroll-mt-24 border-b border-line py-6">
                <div className="flex gap-4">
                  <Link href={`/plants/${pp.slug}/`} className="shrink-0">
                    <PlantImage src={pp.photo?.url} name={pp.common_name} botanical={pp.botanical_name} className="size-20 rounded-2xl md:size-24" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/plants/${pp.slug}/`} className="font-bold hover:underline">
                          {name(pp)}
                        </Link>
                        <p className="font-deva text-sm text-muted">{pp.hindi_name}</p>
                      </div>
                      {pl.planted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                          <Check className="size-3" /> {pl.owned ? "Yours" : "Planted"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] text-ink-2">
                      <span className="font-semibold">{z.label}</span> · {pl.potL} L pot · {inr(pp.price_inr_min, pp.price_inr_max)}
                    </p>
                    <ul className="mt-2 space-y-1 text-[13px] text-muted">
                      {pl.reasons.map((r) => (
                        <li key={r} className="flex gap-1.5">
                          <Leaf className="mt-0.5 size-3.5 shrink-0 text-accent" /> {r}
                        </li>
                      ))}
                      {pl.warnings.map((w) => (
                        <li key={w} className="flex gap-1.5 text-warm">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <button type="button" onClick={() => actions.togglePlanted(pp.id)} className="rounded-full bg-subtle px-3 py-1.5 hover:bg-subtle-2">
                        {pl.planted ? "Not planted yet" : "Mark planted"}
                      </button>
                      {!pl.owned && pl.alternatives.length > 0 && (
                        <button type="button" onClick={() => setSwapFor(swapping ? null : pp.id)} className="rounded-full bg-subtle px-3 py-1.5 hover:bg-subtle-2">
                          Swap
                        </button>
                      )}
                      <button type="button" onClick={() => actions.remove(pp.id)} className="rounded-full px-3 py-1.5 text-muted hover:text-ink">
                        Remove
                      </button>
                      {pl.breakdown && (
                        <button type="button" onClick={() => setScoreFor(scoreFor === pp.id ? null : pp.id)} className="rounded-full px-3 py-1.5 text-muted hover:text-ink">
                          {scoreFor === pp.id ? "Hide score" : "Why this score?"}
                        </button>
                      )}
                    </div>
                    {scoreFor === pp.id && pl.breakdown && <ScoreBreakdown breakdown={pl.breakdown} score={pl.score} />}
                    {swapping && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pl.alternatives
                          .map((id) => enginePlantMap.get(id))
                          .filter((x): x is EnginePlant => !!x && !derived.placements.some((y) => y.plantId === x.id))
                          .map((alt) => (
                            <button
                              key={alt.id}
                              type="button"
                              onClick={() => {
                                actions.swap(pp.id, alt.id);
                                setSwapFor(null);
                              }}
                              className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1 pl-1 pr-3 text-xs font-semibold text-accent"
                            >
                              <PlantImage src={alt.photo?.thumb_url} name={alt.common_name} botanical={alt.botanical_name} className="size-6 rounded-full" />
                              {name(alt)}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <AddPlant onAdd={(id, force) => actions.add(id, undefined, force)} exclude={derived.placements.map((x) => x.plantId)} />
        {state.plan.relaxed && (
          <p className="mt-8 rounded-2xl bg-warm-soft p-4 text-sm">
            Your space is tough for plants right now (deep shade or harsh weather), so we&apos;ve included hardy plants that need a little
            protection. Each one says what to do.
          </p>
        )}
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer font-semibold">How we choose, and why not other plants?</summary>
          {state.plan.excluded.length > 0 && (
            <ul className="mt-3 space-y-1 text-muted">
              {state.plan.excluded.map((e) => (
                <li key={e.reason}>{EXCLUDE_LABEL[e.reason](e.count)}</li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <HowWeChoose />
          </div>
        </details>
      </Section>

      {/* Impact */}
      <Section title="Garden Harmony Score" sub="How well-balanced your garden is, and how each part scores. Model-based estimates.">
        <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-16">
          <div className="flex flex-col items-center">
            <HarmonyRing value={derived.impact.harmony.total} />
            <p className="mt-3 text-sm font-semibold">Garden Harmony Score</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <dl className="divide-y divide-line">
              {[
                [`${derived.impact.greenAreaM2} m²`, "of leaves and vines on your space"],
                [`${derived.impact.waterLPerWeek} L`, `water a week (${derived.impact.waterSavedPct}% less than a thirsty plant mix)`],
                [`${derived.impact.pollinatorPct}%`, "pollinator support"],
                [`${derived.impact.co2KgPerYear[0]}–${derived.impact.co2KgPerYear[1]} kg`, "CO₂ taken up a year (rough)"],
              ].map(([v, t]) => (
                <div key={t} className="flex items-baseline gap-4 py-3 first:pt-0">
                  <dd className="w-24 shrink-0 text-xl font-extrabold tracking-tight">{v}</dd>
                  <dt className="text-sm text-muted">{t}</dt>
                </div>
              ))}
            </dl>
            <ul className="space-y-3">
              {derived.impact.harmony.parts.map((part) => (
                <li key={part.key}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{part.label}</span>
                    <span className="text-muted">{part.value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${part.value}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Shopping + calendar */}
      <div className="grid gap-x-14 md:grid-cols-2">
        {shopping && shopping.count > 0 && (
          <Section title="Shopping list" sub="For plants not yet planted. Prices are for a local nursery; online stores charge about ₹200–500 a plant with pot and delivery.">
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-muted">{shopping.count} plants at a local nursery</dt>
                <dd className="font-bold">{inr(shopping.min, shopping.max)}</dd>
              </div>
              {shopping.pots.map(([l, n]) => (
                <div key={l} className="flex justify-between py-3">
                  <dt className="text-muted">
                    {l} L pot{l <= 5 ? " / planter" : ""}
                  </dt>
                  <dd className="font-semibold">× {n}</dd>
                </div>
              ))}
              <div className="flex justify-between py-3">
                <dt className="text-muted">Potting mix (soil + compost + cocopeat)</dt>
                <dd className="font-semibold">~{shopping.soil} L</dd>
              </div>
            </dl>
          </Section>
        )}
        <Section title="Coming up" sub="Your care calendar for the next three months.">
          <ol className="space-y-6">
            {[0, 1, 2].map((offset) => {
              const m = ((thisMonth - 1 + offset) % 12) + 1;
              const tasks = derived.calendar.filter((t) => t.month === m);
              return (
                <li key={m}>
                  <p className="text-sm font-bold">{MONTHS_LONG[m - 1]}</p>
                  {tasks.length ? (
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                      {tasks.map((t, i) => (
                        <li key={i} className="flex gap-2">
                          {t.kind === "harvest" ? <Sun className="mt-0.5 size-4 shrink-0 text-warm" /> : t.kind === "protect" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warm" /> : <Sprout className="mt-0.5 size-4 shrink-0 text-accent" />}
                          {t.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Routine care only.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <InsightTicker context="tip" variant="bar" className="flex-1" seed="garden" />
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this garden from this device and start over?")) {
              clearGarden();
              window.location.reload();
            }
          }}
          className="py-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
        >
          Start over
        </button>
      </div>
      <p className="mt-6 text-xs text-muted">
        Saved on this device. Weather: Open-Meteo{f.source === "live" ? " (live)" : " climate normals"}. Sun: computed for {city.name.split(" (")[0]} ({city.lat.toFixed(2)}°N), {MONTHS_SHORT[month - 1]} sun path.
      </p>
    </div>
  );
}

function HarmonyRing({ value }: { value: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={`Harmony score ${value} out of 100`}>
      <circle cx={70} cy={70} r={r} fill="none" stroke="var(--subtle-2)" strokeWidth={10} />
      <circle
        cx={70}
        cy={70}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 70 70)"
      />
      <text x={70} y={78} textAnchor="middle" className="fill-ink text-[34px] font-extrabold">
        {value}
      </text>
    </svg>
  );
}

function AddPlant({ onAdd, exclude }: { onAdd: (id: string, force?: boolean) => { ok: boolean; reason?: string }; exclude: string[] }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const matches = searchPlants(enginePlants, q, 6, exclude);
  const tryAdd = (id: string, force = false) => {
    const res = onAdd(id, force);
    const plant = enginePlantMap.get(id)!;
    if (res.ok) {
      setMsg({ id, ok: true, text: `${name(plant)} added${force ? " (with a warning)" : ""}. Find it in your plants list.` });
      setQ("");
    } else setMsg({ id, ok: false, text: res.reason ?? "It doesn't fit here." });
  };
  return (
    <div id="add-plant" className="mt-8 scroll-mt-24">
      <p className="text-sm font-bold">Add a plant you have or want</p>
      <input value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }} placeholder="Search in English, हिंदी or मराठी, e.g. mogra" className="mt-3 h-11 w-full max-w-md rounded-full bg-subtle px-4 outline-none ring-accent/30 focus:ring-2" />
      {matches.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {matches.map((m) => (
            <button key={m.id} type="button" onClick={() => tryAdd(m.id)} className="inline-flex items-center gap-1 rounded-full bg-subtle px-3 py-1.5 text-sm font-medium hover:bg-subtle-2">
              + {name(m)} <span className="text-muted">· {m.hindi_name}</span>
            </button>
          ))}
        </div>
      )}
      {msg && (
        <div role="status" className={`mt-3 max-w-md rounded-2xl p-3.5 text-sm ${msg.ok ? "bg-accent-soft text-ink" : "bg-warm-soft text-ink"}`}>
          <p>{msg.text}</p>
          {!msg.ok && (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => tryAdd(msg.id, true)} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-bg">
                Add anyway
              </button>
              <button type="button" onClick={() => setMsg(null)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted">
                Never mind
              </button>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">We place it in the spot where it grows best, and tell you honestly if your space isn&apos;t right for it.</p>
    </div>
  );
}
