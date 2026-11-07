import type { Metadata } from "next";
import { PlanWizard } from "@/components/plan/PlanWizard";

export const metadata: Metadata = {
  title: "Plan my space",
  description: "Describe your balcony, terrace or windowsill and get a garden plan made for it.",
};

export default function PlanPage() {
  return <PlanWizard />;
}
