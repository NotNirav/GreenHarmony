"use client";

import { AppWindow, Cable, Check, Fence, Grid2x2, Library, Plus, Sofa, Sprout, type LucideIcon } from "lucide-react";
import { capacityTotal, footprint } from "@/lib/space/zones";
import type { EnginePlant, Placement } from "@/lib/engine/types";
import type { SpaceProfile, Zone, ZoneKind } from "@/lib/space/types";
import { PlantImage } from "../plants/PlantImage";
import { MONTHS_SHORT, sunWords } from "./labels";

/** Top-to-bottom, the way the layers sit in a real balcony. */
const ORDER: ZoneKind[] = ["hanging", "climber", "railing", "windowsill", "shelf", "floor_front", "floor_back", "indoor"];

const ICON: Record<ZoneKind, LucideIcon> = {
  hanging: Cable,
  climber: Sprout,
  railing: Fence,
  windowsill: AppWindow,
  shelf: Library,
  floor_front: Grid2x2,
  floor_back: Grid2x2,
  indoor: Sofa,
};

/**
 * The garden as layers: one row per growing zone (hanging, grill, railing, shelf, floor),
 * each with its sun this month, how full it is, and the plants in it.
 */
export function LayoutView({
  profile,
  zones,
  placements,
  plants,
  month,
  selected,
  onSelect,
  onAddClick,
}: {
  profile: SpaceProfile;
  zones: Zone[];
  placements: Placement[];
  plants: Map<string, EnginePlant>;
  month: number;
  selected?: string | null;
  onSelect?: (plantId: string) => void;
  onAddClick?: () => void;
}) {
  const ordered = ORDER.map((k) => zones.find((z) => z.id === k)).filter((z): z is Zone => !!z);

  return (
    <div className="overflow-hidden rounded-[28px] bg-subtle">
      {profile.ceiling !== null && profile.kind !== "terrace" && profile.kind !== "windowsill" && profile.kind !== "indoor" && (
        <div className="h-2 bg-subtle-2" aria-label="Roof" />
      )}
      <ol className="divide-y divide-line">
        {ordered.map((z) => {
          const here = placements.filter((pl) => pl.zoneId === z.id && plants.has(pl.plantId));
          const used = here.reduce((a, pl) => a + footprint(z, pl.potL, plants.get(pl.plantId)!.spread_cm), 0);
          const total = capacityTotal(z);
          const unit = footprint(z, z.capacity.type === "count" ? 1 : 3, 30);
          const room = Math.max(0, Math.floor((total - used) / unit + 1e-6));
          const h = z.sunByMonth[month - 1];
          const Icon = ICON[z.kind];
          return (
            <li key={z.id} className="grid gap-4 p-4 md:grid-cols-[170px_1fr] md:gap-6 md:p-5">
              <div className="flex items-start gap-3 md:block">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-ink-2 md:mb-2">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold">{z.label}</p>
                  <p className="text-xs text-muted">{z.hint}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold">
                    <span className="size-1.5 rounded-full bg-warm" />
                    {h.toFixed(1)} h sun · {MONTHS_SHORT[month - 1]}
                    <span className="font-normal text-muted">({sunWords(h).toLowerCase()})</span>
                  </p>
                </div>
              </div>

              <div className="relative">
                {/* A light visual cue for what this layer physically is. */}
                {z.kind === "hanging" && <div className="absolute inset-x-0 top-0 h-px bg-line" aria-hidden />}
                <ul className="relative flex flex-wrap gap-x-3 gap-y-4">
                  {here.map((pl) => {
                    const p = plants.get(pl.plantId)!;
                    const active = selected === p.id;
                    return (
                      <li key={p.id} className="w-[76px]">
                        <button type="button" onClick={() => onSelect?.(p.id)} aria-pressed={active} className="group flex w-full flex-col items-center text-center">
                          {z.kind === "hanging" && <span className="h-3 w-px bg-muted" aria-hidden />}
                          <span className={`relative rounded-full p-0.5 transition ${active ? "bg-accent" : "bg-bg group-hover:bg-line"}`}>
                            <PlantImage src={p.photo?.thumb_url} name={p.common_name} botanical={p.botanical_name} className="size-[60px] rounded-full" />
                            {pl.planted && (
                              <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-accent text-bg ring-2 ring-subtle">
                                <Check className="size-3" strokeWidth={3} />
                              </span>
                            )}
                          </span>
                          {(z.kind === "floor_front" || z.kind === "floor_back" || z.kind === "climber" || z.kind === "indoor") && (
                            <span className="-mt-1 h-2.5 w-9 rounded-b-md bg-warm/70" aria-hidden />
                          )}
                          {/* Railing planter / shelf plank under the plant */}
                          {(z.kind === "railing" || z.kind === "shelf" || z.kind === "windowsill") && (
                            <span className="-mt-0.5 h-1.5 w-14 rounded-full bg-ink-2/50" aria-hidden />
                          )}
                          <span className="mt-1.5 line-clamp-1 w-full text-[11px] font-semibold leading-tight">{p.common_name.split(" (")[0]}</span>
                          <span className="text-[10px] text-muted">{pl.potL} L</span>
                        </button>
                      </li>
                    );
                  })}
                  {room > 0 && (
                    <li className="w-[76px]">
                      <button type="button" onClick={onAddClick} className="flex w-full flex-col items-center text-center text-muted hover:text-ink">
                        {z.kind === "hanging" && <span className="h-3 w-px bg-line" aria-hidden />}
                        <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-line">
                          <Plus className="size-5" />
                        </span>
                        <span className="mt-1.5 text-[11px] font-semibold leading-tight">Room for {room > 6 ? "6+" : room}</span>
                      </button>
                    </li>
                  )}
                  {here.length === 0 && room === 0 && <li className="text-sm text-muted">Full</li>}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
