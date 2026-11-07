import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { plants, stats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Data sources & photo credits",
  description: "Where GreenHarmony's plant data and photos come from.",
};

const SOURCES = [
  {
    name: "GreenHarmony curated India sheet",
    role: "Source of truth for every plant: Indian names, nursery availability, popularity, ₹ price band, sun, water, pot size, balcony zones, Indian season calendar and care tips.",
    how: "Hand-curated by Team Cultivate and cross-checked against Indian nursery catalogues and agriculture university growing guides.",
    url: null,
  },
  {
    name: "GBIF Species API",
    role: "Validates every botanical name and adds the accepted name and plant family.",
    how: "Open API, no key.",
    url: "https://www.gbif.org/developer/species",
  },
  {
    name: "iNaturalist",
    role: "Plant photos (only CC0 / CC-BY / CC-BY-SA where possible, each credited), plus Wikipedia links and sighting counts.",
    how: "Open API. Photos are linked from iNaturalist, not copied.",
    url: "https://www.inaturalist.org",
  },
  {
    name: "OpenPlantDB",
    role: "Cross-checks days to harvest, spacing and height across thousands of cultivars.",
    how: "CC0 public-domain dataset.",
    url: "https://github.com/cwfrazier1/openplantdb",
  },
  {
    name: "Perenual (optional)",
    role: "Extra care-guide fields when an API key is configured.",
    how: "Free tier: 100 requests/day.",
    url: "https://perenual.com/docs/api",
  },
];

export default function SourcesPage() {
  const credited = plants.filter((p) => p.photo);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 md:px-6 md:pt-14">
      <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Data & photo credits</h1>
      <p className="mt-4 text-pretty text-muted md:text-lg">
        Dataset built {stats.generated}: {stats.plants} plants across {stats.families} plant families, {stats.with_gbif} names
        verified on GBIF, {stats.with_photo} with photos, {stats.with_openplantdb} cross-checked against OpenPlantDB.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {SOURCES.map((s) => (
          <li key={s.name} className="py-5">
            <p className="font-semibold">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                  {s.name} <ArrowUpRight className="size-4" aria-hidden />
                </a>
              ) : (
                s.name
              )}
            </p>
            <p className="mt-1 text-[15px] text-ink-2">{s.role}</p>
            <p className="mt-1 text-xs text-muted">{s.how}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted">
        Sun, water and temperature values are guidance for Indian plains conditions, not lab measurements. Impact figures shown
        in the app are model-based estimates.
      </p>

      <h2 className="mt-14 text-2xl font-extrabold tracking-tight">Photo credits</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {credited.map((p) => (
          <li key={p.id} className="truncate">
            <Link href={`/plants/${p.slug}/`} className="font-semibold hover:underline">
              {p.common_name}
            </Link>
            <span className="text-muted">
              {" "}
              — <a href={p.photo!.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {p.photo!.attribution ?? "iNaturalist"}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
