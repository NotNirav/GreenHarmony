import type { PlantLite } from "@/lib/types";
import { PlantCard } from "./PlantCard";

/** Horizontal swipe rail on phones, tidy grid on larger screens. */
export function PlantRail({ plants, cols = 6 }: { plants: PlantLite[]; cols?: 4 | 5 | 6 }) {
  const grid = { 4: "md:grid-cols-4", 5: "md:grid-cols-4 lg:grid-cols-5", 6: "md:grid-cols-4 lg:grid-cols-6" }[cols];
  return (
    <ul className={`no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:grid md:gap-6 md:overflow-visible md:px-0 ${grid}`}>
      {plants.map((p) => (
        <li key={p.id} className="w-[42vw] max-w-[200px] shrink-0 snap-start md:w-auto md:max-w-none">
          <PlantCard plant={p} />
        </li>
      ))}
    </ul>
  );
}
