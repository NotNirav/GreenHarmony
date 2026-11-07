import { HARD_RULES, WEIGHTS, type Tier, type WeightKey } from "@/lib/engine/weights";
import type { Breakdown } from "@/lib/engine/types";

const TIER_LABEL: Record<Tier, string> = { major: "Major", medium: "Medium", minor: "Just for fun" };

/** Per-plant: points earned on each weighted factor. */
export function ScoreBreakdown({ breakdown, score }: { breakdown: Breakdown; score: number }) {
  const keys = Object.keys(WEIGHTS) as WeightKey[];
  return (
    <div className="mt-3 rounded-2xl bg-subtle p-4">
      <p className="text-xs font-semibold text-muted">Score {score} / 100</p>
      <ul className="mt-2 space-y-1.5">
        {keys.map((k) => {
          const w = WEIGHTS[k];
          const got = breakdown[k] ?? 0;
          return (
            <li key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs">
              <span className="truncate">{w.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-subtle-2">
                <span className={`block h-full rounded-full ${w.tier === "minor" ? "bg-warm" : "bg-accent"}`} style={{ width: `${(got / w.pts) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted">
                {got.toFixed(0)}/{w.pts}
              </span>
            </li>
          );
        })}
        {(breakdown.penalty ?? 0) < 0 && (
          <li className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs text-warm">
            <span>Microclimate</span>
            <span />
            <span className="text-right tabular-nums">{breakdown.penalty}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Garden-level explainer of how much each answer counts. */
export function HowWeChoose() {
  const tiers: Tier[] = ["major", "medium", "minor"];
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="text-sm font-bold">Hard rules (a plant is left out if it breaks one)</p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
          {HARD_RULES.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-2" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-5">
        {tiers.map((t) => (
          <div key={t}>
            <p className="text-sm font-bold">{TIER_LABEL[t]}</p>
            <ul className="mt-2 space-y-2">
              {(Object.values(WEIGHTS) as (typeof WEIGHTS)[WeightKey][])
                .filter((w) => w.tier === t)
                .map((w) => (
                  <li key={w.key} className="grid grid-cols-[1fr_56px] items-center gap-3">
                    <span>
                      <span className="block text-sm font-semibold">{w.label}</span>
                      <span className="block text-xs text-muted">{w.from}</span>
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums">{w.pts} pts</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
