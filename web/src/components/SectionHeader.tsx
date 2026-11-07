import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({ title, sub, href, linkLabel = "See all" }: { title: string; sub?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-7">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h2>
        {sub && <p className="mt-1.5 text-sm text-muted md:text-base">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">
          {linkLabel}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
