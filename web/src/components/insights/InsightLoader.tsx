"use client";

import { InsightTicker } from "./InsightTicker";

/** Loading screen: a swaying sprout plus a rotating loading-context insight. */
export function InsightLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-5 px-6 text-center" role="status">
      <svg viewBox="0 0 24 24" className="animate-sway size-9 text-accent" fill="currentColor" aria-hidden>
        <path d="M11.2 21.5v-6.3C6.4 15 3 11.6 3 6.6V4.5h1.6c3.3 0 5.8 1.5 7 4 1.4-3.3 4.4-5.3 8.2-5.3H21v2.2c0 5.6-3.7 9.3-8.8 9.7v6.4h-1Z" />
      </svg>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <InsightTicker context="loading" variant="plain" interval={3500} className="min-h-12 text-base" seed="loader" />
    </div>
  );
}
