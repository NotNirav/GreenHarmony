import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Droplet, IndianRupee, Leaf, PawPrint, Ruler, Sprout, Store, Sun, Thermometer } from "lucide-react";
import { getPlantBySlug, insightsForPlant, lite, plants, similarPlants } from "@/lib/data";
import { AVAILABILITY_LABEL, BENEFIT_LABEL, CATEGORY_LABEL, ZONE_HINT, ZONE_LABEL, heightLabel, inr, sunHours } from "@/lib/labels";
import { PlantImage } from "@/components/plants/PlantImage";
import type { Plant } from "@/lib/types";
import { PlantRail } from "@/components/plants/PlantRail";
import { MonthStrip } from "@/components/plants/MonthStrip";
import { InsightTicker } from "@/components/insights/InsightTicker";
import { SectionHeader } from "@/components/SectionHeader";

export function generateStaticParams() {
  return plants.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const plant = getPlantBySlug(slug);
  if (!plant) return {};
  const title = `${plant.common_name.split(" (")[0]} · ${plant.hindi_name}`;
  const description = `${plant.why_popular}. ${sunHours(plant.sun_min_hrs, plant.sun_max_hrs)}, ${plant.water} water.`;
  const images = plant.photo ? [{ url: plant.photo.url, alt: plant.common_name }] : undefined;
  return { title, description, openGraph: { title, description, images }, twitter: { card: "summary_large_image", images } };
}

/** What the same plant costs online, from a real listing when we checked one. */
function onlinePrice(plant: { price_basis: string; price_checks: { channel: string; price_inr: number; source: string }[] }): string {
  const online = plant.price_checks.find((c) => c.channel === "online");
  if (online) return `Online ₹${online.price_inr} with pot and delivery (${new URL(online.source).hostname.replace("www.", "")}, Oct 2026)`;
  return plant.price_basis === "seedling" ? "A seed packet costs about ₹20–60" : "Online stores charge about ₹200–500 with pot and delivery";
}

function Fact({ icon: Icon, label, value, sub }: { icon: typeof Sun; label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-3 py-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden strokeWidth={1.8} />
      <div className="min-w-0">
        <dt className="text-[13px] text-muted">{label}</dt>
        <dd className="font-semibold leading-snug">
          {value}
          {sub && <span className="block text-[13px] font-normal text-muted">{sub}</span>}
        </dd>
      </div>
    </div>
  );
}

function Bar({ value, max = 5, label, hint }: { value: number; max?: number; label: string; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">{hint}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-ink" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export default async function PlantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plant = getPlantBySlug(slug);
  if (!plant) notFound();

  const name = plant.common_name.split(" (")[0];
  const related = insightsForPlant(plant.id);
  const similar = similarPlants(plant).map(lite);
  const peakLabel = plant.edible && plant.days_to_harvest ? "Harvest" : plant.benefits.includes("flowers") ? "In bloom" : "At its best";
  const ease = plant.beginner_score >= 70 ? "Easy" : plant.beginner_score >= 45 ? "Moderate" : "Needs attention";
  const drought = { low: 1, medium: 3, high: 5 }[plant.drought_tolerance];

  return (
    <article className="mx-auto max-w-6xl px-4 md:px-6">
      <Link href="/plants/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink md:mt-8">
        <ArrowLeft className="size-4" aria-hidden /> Plant library
      </Link>

      <div className="mt-5 grid gap-8 md:mt-8 md:grid-cols-2 md:gap-14">
        <figure className="md:sticky md:top-24 md:self-start">
          <div className="-mx-4 overflow-hidden md:mx-0 md:rounded-[28px]">
            <PlantImage
              src={plant.photo?.large_url}
              name={plant.common_name}
              botanical={plant.botanical_name}
              priority
              className="aspect-[4/3] w-full md:aspect-[4/5]"
            />
          </div>
          {plant.photo && (
            <figcaption className="mt-2.5 text-xs text-muted">
              <a href={plant.photo.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                Photo: {plant.photo.attribution ?? "iNaturalist contributor"}
              </a>
            </figcaption>
          )}
        </figure>

        <div>
          <p className="text-sm font-semibold text-accent">
            {CATEGORY_LABEL[plant.category]}
            {plant.popularity === 5 && <span className="text-muted"> · Indian bestseller</span>}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">{name}</h1>
          <p className="mt-3 font-deva text-xl text-ink-2">
            {plant.hindi_name}
            {plant.marathi_name && plant.marathi_name !== plant.hindi_name && <span className="text-muted"> · {plant.marathi_name}</span>}
          </p>
          <p className="mt-1 text-sm italic text-muted">
            {plant.botanical_name}
            {plant.taxonomy?.family && <span className="not-italic"> · {plant.taxonomy.family}</span>}
          </p>
          {plant.other_names.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Also called{" "}
              {plant.other_names
                .filter((n, i, all) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i)
                .map((n) => (/[ऀ-ॿ]/.test(n) ? n : n.replace(/(^|\s)\S/g, (c) => c.toUpperCase())))
                .join(", ")}
            </p>
          )}

          <blockquote className="mt-7 border-l-2 border-accent pl-4 text-lg leading-relaxed text-ink-2">{plant.why_popular}.</blockquote>

          <div className="mt-6 flex flex-wrap gap-2">
            {plant.benefits.map((b) => (
              <span key={b} className="rounded-full bg-subtle px-3 py-1.5 text-[13px] font-medium text-ink-2">
                {BENEFIT_LABEL[b] ?? b}
              </span>
            ))}
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 border-t border-line [&>*]:border-b [&>*]:border-line">
            <Fact icon={Sun} label="Sunlight" value={sunHours(plant.sun_min_hrs, plant.sun_max_hrs)} />
            <Fact
              icon={Droplet}
              label="Water"
              value={plant.water[0].toUpperCase() + plant.water.slice(1)}
              sub={`~${plant.water_l_per_week} L / week in summer`}
            />
            <Fact icon={Ruler} label="Pot" value={`${plant.min_pot_l} L or bigger`} sub={`${plant.pot_depth_cm} cm deep`} />
            <Fact icon={Sprout} label="Grows to" value={heightLabel(plant.height_cm)} sub={`${heightLabel(plant.spread_cm)} wide`} />
            <Fact icon={Thermometer} label="Temperature" value={`${plant.temp_min_c}–${plant.temp_max_c} °C`} />
            <Fact
              icon={IndianRupee}
              label={plant.price_basis === "seedling" ? "Local nursery, per seedling" : "Local nursery price"}
              value={inr(plant.price_inr_min, plant.price_inr_max)}
              sub={onlinePrice(plant)}
            />
            <Fact icon={Store} label="Where to buy" value={AVAILABILITY_LABEL[plant.availability]} />
            <Fact
              icon={PawPrint}
              label="Pets & kids"
              value={plant.pet_safe === "yes" ? "Safe" : plant.pet_safe === "no" ? "Keep out of reach" : "Not confirmed"}
            />
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-bold">
              How easy is it? <span className="text-accent">{ease}</span>
            </h2>
            <div className="mt-5 space-y-5">
              <Bar label="Care needed" value={plant.maintenance} hint={["", "Very little", "Little", "Some", "Regular", "A lot"][plant.maintenance]} />
              <Bar label="Handles dry spells" value={drought} hint={plant.drought_tolerance === "high" ? "Very well" : plant.drought_tolerance === "medium" ? "Okay" : "Poorly"} />
              <Bar label="Bees & butterflies" value={plant.pollinator} max={3} hint={["None", "Some", "Good", "Magnet"][plant.pollinator]} />
            </div>
          </section>
        </div>
      </div>

      <GivesBack plant={plant} />

      <div className="mt-16 grid gap-12 border-t border-line pt-12 md:mt-24 md:grid-cols-2 md:gap-14">
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">Where it fits</h2>
          <ul className="mt-5 divide-y divide-line">
            {plant.zones.map((z) => (
              <li key={z} className="flex items-baseline justify-between gap-4 py-3">
                <span className="font-semibold">{ZONE_LABEL[z]}</span>
                <span className="text-sm text-muted">{ZONE_HINT[z]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {plant.habit[0].toUpperCase() + plant.habit.slice(1)} · {plant.lifecycle} · grows {plant.growth_rate} · start from{" "}
            {plant.propagation.join(" or ")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">Season calendar</h2>
          <p className="mt-1 text-sm text-muted">Indian plains (Pune, central India). Hill stations run later.</p>
          <div className="mt-6">
            <MonthStrip plant={plant.plant_months} peak={plant.peak_months} peakLabel={peakLabel} />
          </div>
          {plant.days_to_harvest > 0 && (
            <p className="mt-5 text-sm text-ink-2">
              <Leaf className="mr-1.5 inline size-4 text-accent" aria-hidden />
              First harvest in about <span className="font-semibold">{plant.days_to_harvest} days</span>.
            </p>
          )}
        </section>
      </div>

      <section className="mt-12 rounded-[28px] bg-subtle p-6 md:mt-16 md:p-10">
        <p className="text-sm font-semibold text-accent">Care tip</p>
        <p className="mt-2 max-w-3xl text-pretty text-xl font-semibold leading-snug tracking-tight md:text-2xl">{plant.care_tip}.</p>
        {related.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-line pt-5 text-[15px] text-ink-2">
            {related.map((i) => (
              <li key={i.id}>{i.text}</li>
            ))}
          </ul>
        )}
      </section>

      {(plant.links.wikipedia || plant.links.inaturalist || plant.taxonomy) && (
        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {plant.links.wikipedia && (
            <a href={plant.links.wikipedia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-ink">
              Wikipedia <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {plant.links.inaturalist && (
            <a href={plant.links.inaturalist} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-ink">
              iNaturalist{plant.inat_observations ? ` · ${plant.inat_observations.toLocaleString("en-IN")} sightings` : ""}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {plant.taxonomy && (
            <a
              href={`https://www.gbif.org/species/${plant.taxonomy.gbif_key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-ink"
            >
              GBIF <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
        </p>
      )}

      <section className="mt-16 md:mt-24">
        <SectionHeader title="Grows well alongside" href="/plants/" linkLabel="All plants" />
        <PlantRail plants={similar} />
      </section>

      <InsightTicker context="tip" variant="bar" className="mt-14" seed={plant.id} />
    </article>
  );
}

/** What one pot of this plant gives back to the city (estimates from its size and traits). */
function GivesBack({ plant }: { plant: Plant }) {
  const canopy = Math.PI * Math.pow(Math.min(plant.spread_cm, 60) / 200, 2); // pots keep plants compact
  const co2 = [Math.max(0.1, Math.round(canopy * 0.5 * 10) / 10), Math.max(0.2, Math.round(canopy * 2 * 10) / 10)];
  const items = [
    plant.pollinator >= 2 && { t: "Food for bees and butterflies", d: plant.pollinator === 3 ? "A pollinator magnet." : "Visited by pollinators when in flower." },
    plant.edible && { t: "Food from your balcony", d: plant.days_to_harvest ? `First harvest in about ${plant.days_to_harvest} days, with zero food miles.` : "Something to eat or brew, grown at home." },
    { t: `About ${Math.round(canopy * 100) / 100} m² of leaves`, d: `Shade and evaporation cool the air around it, and it takes up roughly ${co2[0]}–${co2[1]} kg of CO₂ a year.` },
    plant.water === "low" && { t: "Water-wise", d: `Only ~${plant.water_l_per_week} L a week even in summer.` },
    plant.benefits.includes("sacred") && { t: "Keeps traditions alive", d: "Fresh flowers or leaves for daily pooja, no plastic packets." },
    plant.benefits.includes("medicinal") && { t: "A home remedy", d: "A traditional medicinal plant (consult a doctor before use)." },
  ].filter(Boolean) as { t: string; d: string }[];
  return (
    <section className="mt-12 rounded-[28px] bg-accent-soft p-6 md:mt-16 md:p-8">
      <p className="text-sm font-semibold text-accent">Every plant counts</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">What one {plant.common_name.split(" (")[0]} gives back</h2>
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.t}>
            <p className="font-bold">{i.t}</p>
            <p className="mt-0.5 text-sm text-ink-2">{i.d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">Estimates from its typical size and needs in a pot.</p>
    </section>
  );
}
