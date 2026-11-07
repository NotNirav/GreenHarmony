import Link from "next/link";
import { inr } from "@/lib/labels";
import type { PlantLite } from "@/lib/types";
import { PlantImage } from "./PlantImage";
import { CareMeta } from "./Badges";

export function PlantCard({ plant, priority = false }: { plant: PlantLite; priority?: boolean }) {
  return (
    <Link href={`/plants/${plant.slug}/`} className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <div className="aspect-square overflow-hidden rounded-2xl">
        <PlantImage
          src={plant.photo?.url}
          name={plant.common_name}
          botanical={plant.botanical_name}
          priority={priority}
          className="size-full transition duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-tight">{plant.common_name.split(" (")[0]}</h3>
          {plant.beginner_friendly && <span className="shrink-0 text-[11px] font-semibold text-accent">Easy</span>}
        </div>
        <p className="truncate font-deva text-[13px] text-muted">{plant.hindi_name}</p>
        <CareMeta sun={plant.sun_class} water={plant.water} className="pt-1" />
        <p className="pt-0.5 text-[13px] font-medium text-ink-2">{inr(plant.price_inr_min, plant.price_inr_max)}
          {plant.price_basis === "seedling" && <span className="font-normal text-muted"> / seedling</span>}
        </p>
      </div>
    </Link>
  );
}
