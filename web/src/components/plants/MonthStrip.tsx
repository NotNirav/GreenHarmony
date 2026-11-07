import { MONTHS } from "@/lib/labels";

/** 12-month Indian season strip: when to plant and when it flowers / is harvested. */
export function MonthStrip({ plant, peak, peakLabel }: { plant: number[]; peak: number[]; peakLabel: string }) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-1">
        {MONTHS.map((m, i) => {
          const month = i + 1;
          const p = plant.includes(month);
          const k = peak.includes(month);
          return (
            <div key={m} className="flex flex-col items-center gap-1.5">
              <span className={`h-1.5 w-full rounded-full ${p ? "bg-accent" : "bg-subtle-2"}`} title={p ? `Plant in ${m}` : undefined} />
              <span className={`h-1.5 w-full rounded-full ${k ? "bg-warm" : "bg-subtle-2"}`} title={k ? `${peakLabel} in ${m}` : undefined} />
              <span className="mt-1 text-[10px] font-medium text-muted sm:text-xs">
                {m[0]}
                <span className="hidden sm:inline">{m.slice(1)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-accent" /> Plant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-warm" /> {peakLabel}
        </span>
      </div>
    </div>
  );
}
