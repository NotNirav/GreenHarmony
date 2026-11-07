import type { Metadata } from "next";
import { PlantLibrary } from "@/components/plants/PlantLibrary";
import { stats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Plant library",
  description: "Browse nursery-available plants for Indian balconies, filtered by sun, water and space.",
};

export default function PlantsPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Plant library</h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted md:text-lg">
          {stats.plants} plants you can actually buy at an Indian nursery, with Hindi and Marathi names, sun and water needs,
          and which spot on your balcony suits them.
        </p>
      </div>
      <PlantLibrary />
    </>
  );
}
