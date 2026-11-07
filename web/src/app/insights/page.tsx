import type { Metadata } from "next";
import { InsightsBrowser } from "@/components/insights/InsightsBrowser";
import { stats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Insights",
  description: "Quick plant tips for Indian balcony gardeners: watering, sunlight, pests, seasons, culture and climate.",
};

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-14">
      <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">Insights</h1>
      <p className="mt-3 max-w-xl text-pretty text-muted md:text-lg">
        {stats.insights} quick tips for growing in Indian homes. You&apos;ll also find them while pages load and as you move around.
      </p>
      <InsightsBrowser />
    </div>
  );
}
