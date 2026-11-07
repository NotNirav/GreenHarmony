import type { Zone } from "@/lib/space/types";
import { MONTHS_SHORT, sunWords } from "./labels";

/** Each growing zone with this month's sun and a 12-month sparkline. */
export function ZoneSunList({ zones, month, onMonth }: { zones: Zone[]; month: number; onMonth?: (m: number) => void }) {
  const peak = Math.max(6, ...zones.flatMap((z) => z.sunByMonth));
  return (
    <ul className="divide-y divide-line">
      {zones.map((z) => {
        const h = z.sunByMonth[month - 1];
        return (
          <li key={z.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{z.label}</p>
              <p className="text-xs text-muted">
                {sunWords(h)} · {h.toFixed(1)} h in {MONTHS_SHORT[month - 1]}
              </p>
            </div>
            <div className="flex h-8 items-end gap-[2px]" aria-label={`${z.label} sun across the year`}>
              {z.sunByMonth.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onMonth?.(i + 1)}
                  title={`${MONTHS_SHORT[i]}: ${v} h`}
                  className={`w-1.5 rounded-sm transition-colors ${i + 1 === month ? "bg-warm" : "bg-subtle-2 hover:bg-muted"}`}
                  style={{ height: `${Math.max(8, (v / peak) * 100)}%` }}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
