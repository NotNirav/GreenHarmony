import Link from "next/link";
import { stats } from "@/lib/data";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 hidden border-t border-line md:block">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-10 text-sm text-muted">
        <div className="space-y-3">
          <Logo />
          <p>Team Cultivate · Indradhanu 2026 · AI for Climate Change</p>
        </div>
        <div className="flex gap-6">
          <Link href="/sources/" className="hover:text-ink">
            Data & photo credits
          </Link>
          <span>
            {stats.plants} plants · updated {stats.generated}
          </span>
        </div>
      </div>
    </footer>
  );
}
