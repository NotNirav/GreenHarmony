"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { plantIndex as plants } from "@/lib/client-data";
import { queryScore } from "@/lib/search";
import { CATEGORY_LABEL, SUN_LABEL, ZONE_LABEL } from "@/lib/labels";
import type { Category, Level, PlantLite as Plant, SunClass, Zone } from "@/lib/types";
import { EmptyState } from "../insights/EmptyState";
import { InsightTicker } from "../insights/InsightTicker";
import { PlantCard } from "./PlantCard";

type Toggle = "beginner" | "edible" | "pet_safe" | "pollinator" | "fragrance" | "sacred" | "everywhere";
type Sort = "popular" | "easiest" | "az" | "cheapest";

interface Filters {
  q: string;
  categories: Category[];
  sun: SunClass[];
  /** How much watering you can manage; shows plants that need this much or less. */
  water: Level | null;
  zones: Zone[];
  toggles: Toggle[];
  sort: Sort;
}

const EMPTY: Filters = { q: "", categories: [], sun: [], water: null, zones: [], toggles: [], sort: "popular" };

const TOGGLES: { key: Toggle; label: string; test: (p: Plant) => boolean }[] = [
  { key: "beginner", label: "Beginner-friendly", test: (p) => p.beginner_friendly },
  { key: "edible", label: "Grow food", test: (p) => p.edible },
  { key: "everywhere", label: "In every nursery", test: (p) => p.availability === "everywhere" },
  { key: "pollinator", label: "Bees & butterflies", test: (p) => p.pollinator >= 2 },
  { key: "fragrance", label: "Fragrant", test: (p) => p.benefits.includes("fragrance") },
  { key: "sacred", label: "Pooja plants", test: (p) => p.benefits.includes("sacred") },
  { key: "pet_safe", label: "Pet-safe", test: (p) => p.pet_safe === "yes" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "easiest", label: "Easiest first" },
  { key: "cheapest", label: "Lowest price" },
  { key: "az", label: "A–Z" },
];

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const SUNS = Object.keys(SUN_LABEL) as SunClass[];
const WATER_RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };
const WATERS: { key: Level; label: string }[] = [
  { key: "low", label: "Once a week" },
  { key: "medium", label: "Every 2–3 days" },
  { key: "high", label: "Daily" },
];
const ZONES = Object.keys(ZONE_LABEL) as Zone[];

function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function readUrl(): Filters {
  const sp = new URLSearchParams(window.location.search);
  const list = <T,>(k: string) => (sp.get(k)?.split(",").filter(Boolean) ?? []) as T[];
  return {
    q: sp.get("q") ?? "",
    categories: list<Category>("category"),
    sun: list<SunClass>("sun"),
    water: (list<Level>("water").find((w) => w in WATER_RANK) ?? null) as Level | null,
    zones: list<Zone>("zone"),
    toggles: list<Toggle>("only"),
    sort: (sp.get("sort") as Sort) || "popular",
  };
}

function writeUrl(f: Filters) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.categories.length) sp.set("category", f.categories.join(","));
  if (f.sun.length) sp.set("sun", f.sun.join(","));
  if (f.water) sp.set("water", f.water);
  if (f.zones.length) sp.set("zone", f.zones.join(","));
  if (f.toggles.length) sp.set("only", f.toggles.join(","));
  if (f.sort !== "popular") sp.set("sort", f.sort);
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function applyFilters(f: Filters): Plant[] {
  const scores = new Map(plants.map((p) => [p.id, queryScore(p, f.q)]));
  const out = plants.filter(
    (p) =>
      scores.get(p.id)! > 0 &&
      (!f.categories.length || f.categories.includes(p.category)) &&
      (!f.sun.length || f.sun.includes(p.sun_class)) &&
      (!f.water || WATER_RANK[p.water] <= WATER_RANK[f.water]) &&
      (!f.zones.length || f.zones.some((z) => p.zones.includes(z))) &&
      f.toggles.every((t) => TOGGLES.find((x) => x.key === t)!.test(p)),
  );
  const sorters: Record<Sort, (a: Plant, b: Plant) => number> = {
    popular: (a, b) => b.popularity - a.popularity || a.common_name.localeCompare(b.common_name),
    easiest: (a, b) => b.beginner_score - a.beginner_score || b.popularity - a.popularity,
    cheapest: (a, b) => a.price_inr_min - b.price_inr_min || b.popularity - a.popularity,
    az: (a, b) => a.common_name.localeCompare(b.common_name),
  };
  // When searching, relevance wins; the chosen sort breaks ties.
  return out.sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || sorters[f.sort](a, b));
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-bg" : "bg-subtle text-ink-2 hover:bg-subtle-2"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-bold text-ink">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function FilterControls({ f, set }: { f: Filters; set: (f: Filters) => void }) {
  return (
    <div className="space-y-7">
      <FilterGroup title="Show only">
        {TOGGLES.map((t) => (
          <Chip key={t.key} active={f.toggles.includes(t.key)} onClick={() => set({ ...f, toggles: toggleIn(f.toggles, t.key) })}>
            {t.label}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="Sunlight on your balcony">
        {SUNS.map((s) => (
          <Chip key={s} active={f.sun.includes(s)} onClick={() => set({ ...f, sun: toggleIn(f.sun, s) })}>
            {SUN_LABEL[s]}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="How often can you water?">
        {WATERS.map((w) => (
          <Chip key={w.key} active={f.water === w.key} onClick={() => set({ ...f, water: f.water === w.key ? null : w.key })}>
            {w.label}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="Where will it go?">
        {ZONES.map((z) => (
          <Chip key={z} active={f.zones.includes(z)} onClick={() => set({ ...f, zones: toggleIn(f.zones, z) })}>
            {ZONE_LABEL[z]}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="Sort by">
        {SORTS.map((s) => (
          <Chip key={s.key} active={f.sort === s.key} onClick={() => set({ ...f, sort: s.key })}>
            {s.label}
          </Chip>
        ))}
      </FilterGroup>
    </div>
  );
}

export function PlantLibrary() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setF(readUrl());
      setReady(true);
    });
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ready) writeUrl(f);
  }, [f, ready]);

  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  const results = useMemo(() => applyFilters(f), [f]);
  const activeCount = f.sun.length + (f.water ? 1 : 0) + f.zones.length + f.toggles.length + (f.sort !== "popular" ? 1 : 0);
  const anyActive = activeCount + f.categories.length > 0 || f.q;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* Search + mobile filter button */}
      <div className="sticky top-14 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-3 backdrop-blur-xl md:top-16 md:-mx-6 md:px-6">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search plants</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              placeholder="Search tulsi, pudina, जास्वंद, money plant…"
              className="h-12 w-full rounded-full bg-subtle pl-11 pr-4 text-[15px] outline-none ring-accent/30 transition placeholder:text-muted focus:bg-bg focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="relative inline-flex h-12 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-semibold lg:hidden"
          >
            <SlidersHorizontal className="size-5" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-bg">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        {/* Category chips: horizontal scroll on mobile */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
          <Chip active={!f.categories.length} onClick={() => setF({ ...f, categories: [] })}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={f.categories.includes(c)} onClick={() => setF({ ...f, categories: toggleIn(f.categories, c) })}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-10 pt-2 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="no-scrollbar sticky top-44 max-h-[calc(100dvh-12rem)] space-y-8 overflow-y-auto pb-6">
            <FilterControls f={f} set={setF} />
            <InsightTicker context="tip" variant="bar" seed="sidebar" interval={9000} />
          </div>
        </aside>

        <section aria-live="polite">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <p className="text-muted">
              <span className="font-semibold text-ink">{results.length}</span> of {plants.length} plants
            </p>
            {anyActive && (
              <button type="button" onClick={() => setF(EMPTY)} className="font-semibold text-ink underline underline-offset-4">
                Clear all
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="No plants match yet"
              action={
                <button type="button" onClick={() => setF(EMPTY)} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
                  Reset filters
                </button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:gap-x-6 md:gap-y-10 xl:grid-cols-4">
              {results.map((p, i) => (
                <li key={p.id} className="contents">
                  {i === 8 && (
                    <div className="col-span-2 sm:col-span-3 xl:col-span-4">
                      <InsightTicker context="tip" variant="bar" seed="grid" />
                    </div>
                  )}
                  <PlantCard plant={p} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Mobile filter sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setSheet(false)} aria-label="Close filters" />
          <div className="animate-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-bg shadow-float">
            <span className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-subtle-2" aria-hidden />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setSheet(false)} className="grid size-9 place-items-center rounded-full bg-subtle" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <FilterControls f={f} set={setF} />
            </div>
            <div className="flex gap-3 border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setF({ ...EMPTY, q: f.q, categories: f.categories })} className="flex-1 rounded-full py-3 text-sm font-semibold underline underline-offset-4">
                Reset
              </button>
              <button type="button" onClick={() => setSheet(false)} className="flex-[2] rounded-full bg-ink py-3.5 text-sm font-semibold text-bg">
                Show {results.length} plants
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
