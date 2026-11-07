"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, Home as HomeIcon, LocateFixed, PanelTop, Pencil, Search, Sofa, Sparkles } from "lucide-react";
import { buildZones } from "@/lib/space/zones";
import { sunHours } from "@/lib/space/sunmap";
import { DEFAULT_PROFILE, DEMO_PROFILE, type Goal, type SpaceProfile } from "@/lib/space/types";
import { cities, cityMap, enginePlants, nearestCity } from "@/lib/engine/data";
import { GOAL_LABEL } from "@/lib/engine/recommend";
import { searchPlants } from "@/lib/search";
import { decodeProfile, loadGarden, saveGarden } from "@/lib/engine/store";
import { planGarden } from "@/lib/engine/useGarden";
import { SunPanel } from "../space/SunPanel";
import { Compass } from "../space/Compass";
import { FACING_LABEL, MONTHS_LONG } from "../space/labels";
import { InsightLoader } from "../insights/InsightLoader";
import { Cards, Chips, Question, RangeField, Stepper, Toggle } from "./controls";

type StepId = "city" | "kind" | "size" | "facing" | "around" | "fixtures" | "care" | "goals" | "you";

const ALL_STEPS: { id: StepId; title: string; sub: string }[] = [
  { id: "city", title: "Where is your garden?", sub: "Your city sets the sun's path and the weather we plan for." },
  { id: "kind", title: "What kind of space?", sub: "We'll work out the spots you can grow in." },
  { id: "size", title: "How big is it?", sub: "Rough is fine. Width is along the railing or window." },
  { id: "facing", title: "Which way does it face?", sub: "Stand at the railing or window and look out. Your phone's compass app helps." },
  { id: "around", title: "What's around it?", sub: "Railings, walls and buildings decide where the sun actually lands." },
  { id: "fixtures", title: "What can plants use?", sub: "Every layer counts: floor, railing, walls and hooks." },
  { id: "care", title: "How do you like to care for plants?", sub: "We'll only suggest plants that fit your routine." },
  { id: "goals", title: "What do you want from it?", sub: "Pick up to three." },
  { id: "you", title: "Almost done: a little about you", sub: "Just for fun. These only nudge the picks, they never override what grows well." },
];

const GOALS = Object.keys(GOAL_LABEL) as Goal[];

function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const KIND_LABEL = { balcony: "Balcony", terrace: "Terrace / rooftop", windowsill: "Windowsill", indoor: "Indoor corner" } as const;

function summaryRows(p: SpaceProfile, cityName: string): { step: StepId; label: string; value: string }[] {
  const yes = (b: boolean) => (b ? "Yes" : "No");
  return [
    { step: "city", label: "City", value: cityName },
    { step: "kind", label: "Type of space", value: KIND_LABEL[p.kind] },
    { step: "size", label: "Size", value: `${p.width.toFixed(1)} × ${p.depth.toFixed(1)} m${p.ceiling === null ? " · open sky" : ` · roof at ${p.ceiling.toFixed(1)} m`}` },
    { step: "facing", label: "Faces · floor", value: `${FACING_LABEL[p.facing]} · ${p.floor === 0 ? "ground floor" : `${ordinal(p.floor)} floor`}` },
    {
      step: "around",
      label: "Surroundings",
      value: [
        p.railing !== "none" ? `${p.railing} railing` : null,
        p.kind === "balcony" ? `side walls: ${p.sides}` : null,
        { open: "open view", far: "building far away", medium: "building across the road", near: "building very close" }[p.frontView],
        p.trees ? "trees" : null,
        p.sunCalibration != null ? `you see ~${p.sunCalibration.toFixed(1)} h sun` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      step: "fixtures",
      label: "What plants can use",
      value: `Climbing support: ${yes(p.climberSupport)} · hooks: ${p.hooks} · shelf: ${yes(p.shelf)} · walkway: ${yes(p.walkway)}`,
    },
    {
      step: "care",
      label: "Care",
      value: `${{ daily: "Water daily", alternate: "Water every 2–3 days", weekly: "Water weekly" }[p.water]} · ${{ new: "first time", some: "some experience", pro: "experienced" }[p.experience]}${p.travels ? " · travels often" : ""}${p.pets ? " · pets/kids" : ""}`,
    },
    { step: "goals", label: "Goals · budget", value: `${p.goals.map((g) => GOAL_LABEL[g]).join(", ") || "No preference"} · ${p.budget ? `₹${p.budget}` : "no budget limit"}` },
    { step: "you", label: "About you", value: `${p.gardenName || "Unnamed garden"} · ${{ morning: "mornings", evening: "evenings", anytime: "anytime" }[p.enjoy]} · ${{ solo: "just me", family: "family", kids: "with kids" }[p.companions]}` },
  ];
}

function stepsFor(p: SpaceProfile) {
  return ALL_STEPS.filter((s) => !(s.id === "fixtures" && (p.kind === "windowsill" || p.kind === "indoor")));
}

export function PlanWizard() {
  const router = useRouter();
  const [p, setP] = useState<SpaceProfile>(DEFAULT_PROFILE);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  /** gate: a garden already exists · review: summary of answers · wizard: the questions. */
  const [mode, setMode] = useState<"gate" | "review" | "wizard">("wizard");
  const [gardenTitle, setGardenTitle] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [ownedQuery, setOwnedQuery] = useState("");
  const [locating, setLocating] = useState(false);
  // The live sun model sits beside the questions on large screens; on phones it starts collapsed.
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPreviewOpen(window.matchMedia("(min-width: 1024px)").matches));
    return () => clearTimeout(id);
  }, []);
  const month = new Date().getMonth() + 1;

  useEffect(() => {
    const id = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      const shared = sp.get("s") ? decodeProfile(sp.get("s")!) : null;
      const existing = loadGarden();
      if (shared) setP(shared);
      else if (sp.get("demo")) setP(DEMO_PROFILE);
      else if (existing) {
        // A garden already exists: never silently restart the questions.
        setP(existing.profile);
        setEditing(true);
        setGardenTitle(existing.profile.gardenName || `Your ${existing.profile.kind} in ${cityMap.get(existing.profile.cityId)?.name.split(" (")[0] ?? ""}`);
        setMode(sp.get("edit") ? "review" : "gate");
      }
      setReady(true);
    });
    return () => clearTimeout(id);
  }, []);

  const set = <K extends keyof SpaceProfile>(k: K, v: SpaceProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const city = cityMap.get(p.cityId) ?? cities[0];
  const zones = useMemo(() => buildZones(p, city), [p, city]);
  const steps = stepsFor(p);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  // Modelled floor sun this month, for the "does this match?" calibration.
  const modelledFloor = useMemo(() => {
    const ref = p.kind === "windowsill" ? [{ x: 0.1, y: p.width / 2, z: 0.95 }] : p.kind === "indoor" ? [{ x: Math.max(0.5, p.depth), y: p.width / 2, z: 0.8 }] : [{ x: Math.min(0.5, p.depth / 2), y: p.width / 2, z: 0.25 }];
    return sunHours({ ...p, sunCalibration: null }, city, ref, month);
  }, [p, city, month]);

  function setKind(kind: SpaceProfile["kind"]) {
    setP((x) => {
      if (kind === "windowsill") return { ...x, kind, width: Math.min(x.width, 1.5), depth: 0.25, ceiling: 2.1, railing: "none", hooks: 0, shelf: false, climberSupport: false, seating: 0 };
      if (kind === "indoor") return { ...x, kind, width: 1, depth: 1.5, ceiling: 2.7, railing: "none", hooks: 0, shelf: false, climberSupport: false, seating: 0 };
      if (kind === "terrace") return { ...x, kind, width: Math.max(x.width, 4), depth: Math.max(x.depth, 3), ceiling: null, railing: "solid", sides: "none", hooks: 0 };
      return { ...x, kind, width: x.kind === "balcony" ? x.width : 1.8, depth: x.kind === "balcony" ? x.depth : 1.2, ceiling: 2.8, railing: "grill", sides: "both" };
    });
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("cityId", nearestCity(pos.coords.latitude, pos.coords.longitude).id);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  function finish() {
    setBusy(true);
    const existing = loadGarden();
    // Let the loader show for a moment; the engine itself runs in a few milliseconds.
    setTimeout(() => {
      const g = planGarden(p, editing ? existing : null);
      saveGarden(g);
      router.push("/garden/");
    }, 1400);
  }

  if (busy) return <InsightLoader label={editing ? "Re-planning your garden" : "Designing your garden"} />;
  // Wait for any saved/shared balcony so the form never flashes the defaults.
  if (!ready) return <div className="min-h-[60dvh]" aria-hidden />;

  if (mode === "gate") {
    return (
      <div className="mx-auto max-w-xl px-4 pt-14 text-center md:pt-24">
        <p className="text-sm font-semibold text-accent">You already have a garden</p>
        <h1 className="mt-3 text-balance text-4xl font-extrabold tracking-tight md:text-5xl">{gardenTitle}</h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted">
          Your plan is saved and keeps updating with the weather and seasons. Change your space only when something has changed.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link href="/garden/" className="w-full max-w-xs rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
            Open my garden
          </Link>
          <button type="button" onClick={() => setMode("review")} className="w-full max-w-xs rounded-full bg-subtle px-6 py-3.5 text-[15px] font-semibold hover:bg-subtle-2">
            Edit my space
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("Start a brand-new garden? Your current plan will be replaced when you finish.")) return;
              setP(DEFAULT_PROFILE);
              setEditing(false);
              setStep(0);
              setMode("wizard");
            }}
            className="mt-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
          >
            Start a new garden instead
          </button>
        </div>
      </div>
    );
  }

  if (mode === "review") {
    const rows = summaryRows(p, city.name.split(" (")[0]);
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 md:px-6 md:pt-14">
        <p className="text-sm font-semibold text-accent">Edit your space</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">Your answers</h1>
        <p className="mt-3 text-muted">Change anything that&apos;s different now. Plants you&apos;ve planted, swapped or added stay in your plan.</p>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {rows
            .filter((row) => steps.some((s) => s.id === row.step))
            .map((row) => (
              <li key={row.label} className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</p>
                  <p className="mt-0.5 font-semibold">{row.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(steps.findIndex((s) => s.id === row.step));
                    setMode("wizard");
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-subtle px-3.5 py-2 text-sm font-semibold hover:bg-subtle-2"
                >
                  <Pencil className="size-3.5" /> Change
                </button>
              </li>
            ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={finish} className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
            Update my garden <Sparkles className="size-4" />
          </button>
          <Link href="/garden/" className="text-sm font-semibold underline underline-offset-4">
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  const filteredCities = query ? cities.filter((c) => (c.name + c.state).toLowerCase().includes(query.toLowerCase())) : cities;
  const ownedMatches = searchPlants(enginePlants, ownedQuery, 6, p.owned);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-6 md:px-6 md:pt-10 lg:grid-cols-[1fr_400px] lg:gap-16">
      <div className="min-w-0">
        {/* Progress */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-accent">
            {editing ? "Edit your space" : "Plan my space"} · {step + 1} of {steps.length}
          </p>
          {!editing && step === 0 && (
            <button type="button" onClick={() => { setP(DEMO_PROFILE); setStep(steps.length - 1); }} className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
              <Sparkles className="size-4" /> Try the Pune demo
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-1">
          {steps.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-subtle-2"}`} />
          ))}
        </div>

        <h1 key={current.id} className="animate-fade-up mt-8 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
          {current.title}
        </h1>
        <p className="mt-2 text-muted">{current.sub}</p>

        <div className="mt-8 space-y-9">
          {current.id === "city" && (
            <>
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <span className="sr-only">Search city</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your city" className="h-12 w-full rounded-full bg-subtle pl-11 pr-4 outline-none ring-accent/30 focus:ring-2" />
                </label>
                <button type="button" onClick={locate} className="inline-flex h-12 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-semibold hover:bg-subtle-2">
                  <LocateFixed className="size-4" /> {locating ? "Finding…" : "Near me"}
                </button>
              </div>
              <div className="no-scrollbar max-h-80 overflow-y-auto">
                <Chips options={filteredCities.map((c) => ({ value: c.id, label: c.name.split(" (")[0], sub: c.state === c.name ? undefined : undefined }))} value={p.cityId} onChange={(v) => set("cityId", v as string)} />
              </div>
              <p className="text-sm text-muted">
                Selected: <strong className="text-ink">{city.name}</strong>, {city.state} · summers up to {Math.round(city.hottest)} °C, winters down to {Math.round(city.coldest)} °C
              </p>
            </>
          )}

          {current.id === "kind" && (
            <Cards
              value={p.kind}
              onChange={setKind}
              options={[
                { value: "balcony", label: "Balcony", sub: "Covered, with a railing", icon: <PanelTop className="size-6" /> },
                { value: "terrace", label: "Terrace / rooftop", sub: "Open to the sky", icon: <Building2 className="size-6" /> },
                { value: "windowsill", label: "Windowsill", sub: "Small pots by a window", icon: <HomeIcon className="size-6" /> },
                { value: "indoor", label: "Indoor corner", sub: "Inside, near a window", icon: <Sofa className="size-6" /> },
              ]}
            />
          )}

          {current.id === "size" && (
            <>
              <RangeField label={p.kind === "windowsill" ? "Sill length" : p.kind === "indoor" ? "Width of the spot" : "Width (along the railing)"} value={p.width} min={0.4} max={p.kind === "terrace" ? 15 : 6} step={0.1} onChange={(v) => set("width", v)} />
              {p.kind !== "windowsill" && (
                <RangeField label={p.kind === "indoor" ? "Distance from the window" : "Depth (railing to wall)"} value={p.depth} min={p.kind === "indoor" ? 0.3 : 0.6} max={p.kind === "terrace" ? 15 : 4} step={0.1} onChange={(v) => set("depth", v)} />
              )}
              {(p.kind === "balcony" || p.kind === "terrace") && (
                <Question title="Is there a roof or slab above?" hint="A roof blocks the high summer sun on the back of the floor, and keeps rain off.">
                  <Chips
                    options={[{ value: "covered", label: "Covered" }, { value: "open", label: "Open sky" }]}
                    value={p.ceiling === null ? "open" : "covered"}
                    onChange={(v) => set("ceiling", v === "open" ? null : p.ceiling ?? 2.8)}
                  />
                  {p.ceiling !== null && <RangeField label="Height up to the roof" value={p.ceiling} min={2.2} max={4} step={0.1} onChange={(v) => set("ceiling", v)} />}
                </Question>
              )}
            </>
          )}

          {current.id === "facing" && (
            <>
              <Compass value={p.facing} onChange={(v) => set("facing", v)} />
              <Question title="Which floor are you on?" hint="Higher floors are windier and get fewer bees.">
                <Stepper label="floor" value={p.floor} min={0} max={60} onChange={(v) => set("floor", v)} format={(v) => (v === 0 ? "Ground" : ordinal(v))} />
              </Question>
            </>
          )}

          {current.id === "around" && (
            <>
              {(p.kind === "balcony" || p.kind === "terrace") && (
                <Question title={p.kind === "terrace" ? "What's around the edge?" : "What's the railing like?"} hint="A solid wall shades pots on the floor; a grill lets light through and holds climbers.">
                  <Chips
                    options={[
                      { value: "grill", label: "Metal grill" },
                      { value: "solid", label: "Solid wall" },
                      { value: "glass", label: "Glass" },
                      { value: "none", label: "Nothing" },
                    ]}
                    value={p.railing}
                    onChange={(v) => set("railing", v as SpaceProfile["railing"])}
                  />
                  {p.railing !== "none" && <RangeField label="Railing height" value={p.railingHeight} min={0.6} max={1.5} step={0.05} onChange={(v) => set("railingHeight", v)} />}
                </Question>
              )}
              {p.kind === "balcony" && (
                <Question title="Walls on the sides?" hint="Side walls block sun coming in at an angle in the morning or evening.">
                  <Chips options={[{ value: "both", label: "Both sides" }, { value: "one", label: "One side" }, { value: "none", label: "Open sides" }]} value={p.sides} onChange={(v) => set("sides", v as SpaceProfile["sides"])} />
                </Question>
              )}
              <Question title="How far is the nearest building in front?">
                <Chips
                  options={[
                    { value: "open", label: "Open view" },
                    { value: "far", label: "Far", sub: "40 m+" },
                    { value: "medium", label: "Across the road", sub: "15–40 m" },
                    { value: "near", label: "Very close", sub: "<15 m" },
                  ]}
                  value={p.frontView}
                  onChange={(v) => set("frontView", v as SpaceProfile["frontView"])}
                />
              </Question>
              {p.frontView !== "open" && (
                <Question
                  title="How tall is that building compared to your floor?"
                  hint="Taller and closer buildings hide the low morning and evening sun from your balcony."
                >
                  <Chips
                    options={[
                      { value: "lower", label: "Shorter", sub: "I look over it" },
                      { value: "similar", label: "About level with me" },
                      { value: "taller", label: "A few floors taller" },
                      { value: "much_taller", label: "Much taller", sub: "10+ floors above" },
                    ]}
                    value={p.frontHeight}
                    onChange={(v) => set("frontHeight", v as SpaceProfile["frontHeight"])}
                  />
                </Question>
              )}
              <Toggle label="Trees shade it in the morning or evening" checked={p.trees} onChange={(v) => set("trees", v)} />
              <Question
                title={`We estimate ~${modelledFloor.toFixed(1)} h of direct sun on your ${p.kind === "windowsill" ? "sill" : "floor"} in ${MONTHS_LONG[month - 1]}. Does that match?`}
                hint="Optional. If you've noticed differently, tell us and we'll tune the whole model."
              >
                <Chips
                  options={[
                    { value: "model", label: "Sounds right" },
                    { value: "less", label: "I get less" },
                    { value: "more", label: "I get more" },
                    { value: "none", label: "Almost none" },
                  ]}
                  value={p.sunCalibration == null ? "model" : p.sunCalibration < 0.5 ? "none" : p.sunCalibration < modelledFloor ? "less" : "more"}
                  onChange={(v) =>
                    set("sunCalibration", v === "model" ? null : v === "none" ? 0.3 : v === "less" ? Math.max(0.5, modelledFloor * 0.6) : Math.min(10, modelledFloor * 1.5 + 1))
                  }
                />
              </Question>
            </>
          )}

          {current.id === "fixtures" && (
            <div className="divide-y divide-line">
              <Toggle label="A grill, wall or trellis climbers can grow on" sub="Opens up vertical space for vines" checked={p.climberSupport} onChange={(v) => set("climberSupport", v)} />
              <div className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">Hooks for hanging baskets</span>
                  <span className="block text-xs text-muted">Ceiling or railing hooks</span>
                </span>
                <Stepper label="hooks" value={p.hooks} min={0} max={8} onChange={(v) => set("hooks", v)} />
              </div>
              <Toggle label="A shelf or plant stand" sub="Adds small-pot spots" checked={p.shelf} onChange={(v) => set("shelf", v)} />
              <Toggle label="Keep a walkway clear" sub="About 55 cm to walk and water" checked={p.walkway} onChange={(v) => set("walkway", v)} />
              <div className="space-y-3 py-3">
                <span className="block text-sm font-semibold">Seating to keep</span>
                <Chips options={[{ value: 0, label: "None" }, { value: 1, label: "One chair" }, { value: 2, label: "Two chairs" }]} value={p.seating} onChange={(v) => set("seating", v as 0 | 1 | 2)} />
              </div>
            </div>
          )}

          {current.id === "care" && (
            <>
              <Question title="How often can you water?">
                <Chips options={[{ value: "daily", label: "Every day" }, { value: "alternate", label: "Every 2–3 days" }, { value: "weekly", label: "About once a week" }]} value={p.water} onChange={(v) => set("water", v as SpaceProfile["water"])} />
              </Question>
              <Question title="How much have you grown before?">
                <Chips options={[{ value: "new", label: "First time" }, { value: "some", label: "A few plants" }, { value: "pro", label: "Lots" }]} value={p.experience} onChange={(v) => set("experience", v as SpaceProfile["experience"])} />
              </Question>
              <div className="divide-y divide-line">
                <Toggle label="I travel often" sub="We'll favour plants that survive a few days alone" checked={p.travels} onChange={(v) => set("travels", v)} />
                <Toggle label="Pets or small children at home" sub="We'll leave out toxic plants" checked={p.pets} onChange={(v) => set("pets", v)} />
              </div>
            </>
          )}

          {current.id === "goals" && (
            <>
              <Chips multi max={3} options={GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))} value={p.goals} onChange={(v) => set("goals", v as Goal[])} />
              <Question title="Budget for plants">
                <Chips
                  options={[{ value: 0, label: "No limit" }, { value: 500, label: "₹500" }, { value: 1000, label: "₹1,000" }, { value: 2000, label: "₹2,000" }, { value: 5000, label: "₹5,000" }]}
                  value={p.budget ?? 0}
                  onChange={(v) => set("budget", v === 0 ? null : (v as number))}
                />
              </Question>
              <Question title="Plants you already have" hint="Optional. We'll plan around them.">
                <input value={ownedQuery} onChange={(e) => setOwnedQuery(e.target.value)} placeholder="Type a plant, e.g. tulsi or कढीपत्ता" className="h-11 w-full rounded-full bg-subtle px-4 outline-none ring-accent/30 focus:ring-2" />
                {ownedMatches.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ownedMatches.map((m) => (
                      <button key={m.id} type="button" onClick={() => { set("owned", [...new Set([...p.owned, m.id])]); setOwnedQuery(""); }} className="rounded-full bg-subtle px-3 py-1.5 text-sm font-medium hover:bg-subtle-2">
                        + {m.common_name.split(" (")[0]} <span className="text-muted">· {m.hindi_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {p.owned.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {p.owned.map((id) => (
                      <button key={id} type="button" onClick={() => set("owned", p.owned.filter((x) => x !== id))} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
                        {enginePlants.find((x) => x.id === id)?.common_name.split(" (")[0]} ×
                      </button>
                    ))}
                  </div>
                )}
              </Question>
            </>
          )}
        </div>

        {current.id === "you" && (
          <div className="mt-8 space-y-9">
            <Question title="Give your garden a name" hint="Optional. It's how we'll greet it.">
              <input
                value={p.gardenName}
                maxLength={40}
                onChange={(e) => set("gardenName", e.target.value)}
                placeholder="e.g. Hari's Balcony Bagicha"
                className="h-12 w-full max-w-md rounded-full bg-subtle px-5 outline-none ring-accent/30 focus:ring-2"
              />
            </Question>
            <Question title="When do you enjoy your balcony most?">
              <Chips
                options={[
                  { value: "morning", label: "Morning chai", sub: "flowers & butterflies" },
                  { value: "evening", label: "Evenings", sub: "night fragrance" },
                  { value: "anytime", label: "Anytime" },
                ]}
                value={p.enjoy}
                onChange={(v) => set("enjoy", v as SpaceProfile["enjoy"])}
              />
            </Question>
            <Question title="Who's gardening with you?">
              <Chips
                options={[
                  { value: "solo", label: "Just me" },
                  { value: "family", label: "Family", sub: "more to eat" },
                  { value: "kids", label: "Kids", sub: "fast, fun & safe" },
                ]}
                value={p.companions}
                onChange={(v) => set("companions", v as SpaceProfile["companions"])}
              />
            </Question>
          </div>
        )}

        {/* Navigation */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-10 flex items-center justify-between gap-3 bg-bg/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-30">
            <ArrowLeft className="size-4" /> Back
          </button>
          {editing ? (
            <button type="button" onClick={() => setMode("review")} className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
              Done <Check className="size-4" />
            </button>
          ) : last ? (
            <button type="button" onClick={finish} className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
              Design my garden <Sparkles className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg">
              Next <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live spatial preview */}
      <aside className="order-first lg:order-none">
        <div className="lg:sticky lg:top-24">
          <details className="group rounded-3xl bg-subtle p-5" open={previewOpen} onToggle={(e) => setPreviewOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-warm">Live sun model</span>
                <span className="mt-1 block text-sm font-bold">
                  {city.name.split(" (")[0]} · faces {FACING_LABEL[p.facing].toLowerCase()} · {MONTHS_LONG[month - 1]}
                </span>
              </span>
              <span className="text-xs font-semibold text-muted">{previewOpen ? "Hide" : "Show"}</span>
            </summary>
            <div className="mt-4">
              <SunPanel profile={p} city={city} zones={zones} />
              <p className="mt-3 text-xs text-muted">Updates as you answer. Computed from the sun&apos;s real path over {city.name.split(" (")[0]} and your balcony&apos;s shape.</p>
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}
