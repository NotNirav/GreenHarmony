import type { Metadata } from "next";
import { GardenDashboard } from "@/components/garden/GardenDashboard";

export const metadata: Metadata = {
  title: "My garden",
  description: "Your living garden plan: today's watering, weather alerts, season checks and where the sun lands.",
};

export default function GardenPage() {
  return <GardenDashboard />;
}
