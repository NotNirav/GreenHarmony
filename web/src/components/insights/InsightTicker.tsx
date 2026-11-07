"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { markSeen, poolFor, shuffledDeck, stablePick } from "@/lib/insights";
import { INSIGHT_CATEGORY_LABEL } from "@/lib/labels";
import type { Insight, InsightContext } from "@/lib/types";

interface Props {
  context?: InsightContext;
  category?: string;
  /** Rotation interval in ms. */
  interval?: number;
  /** feature: large quote between sections · bar: compact single row · plain: text only */
  variant?: "feature" | "bar" | "plain";
  className?: string;
  seed?: string;
}

/**
 * Rotating one-liner plant insight. First render is deterministic (no hydration mismatch);
 * after mount it shuffles a month-aware deck and rotates, pausing on hover/focus.
 */
export function InsightTicker({ context = "tip", category, interval = 7000, variant = "feature", className = "", seed }: Props) {
  const initial = useMemo(() => {
    const evergreen = poolFor(context, 0, category);
    return stablePick(evergreen.length ? evergreen : poolFor(context, 1, category), seed ?? context + (category ?? ""));
  }, [context, category, seed]);

  const [current, setCurrent] = useState<Insight>(initial);
  const [paused, setPaused] = useState(false);
  const deck = useRef<Insight[]>([]);
  const idx = useRef(0);

  useEffect(() => {
    const month = new Date().getMonth() + 1;
    deck.current = shuffledDeck(poolFor(context, month, category), month);
    idx.current = 0;
  }, [context, category]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (!deck.current.length) return;
      idx.current = (idx.current + 1) % deck.current.length;
      const next = deck.current[idx.current];
      markSeen(next.id);
      setCurrent(next);
    }, interval);
    return () => clearInterval(t);
  }, [paused, interval]);

  const plant = current.plant_links[0];
  const label = INSIGHT_CATEGORY_LABEL[current.category] ?? "Tip";
  const hover = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  const plantLink = plant && (
    <Link
      href={`/plants/${plant.slug}/`}
      className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-accent hover:underline"
    >
      {plant.name}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );

  if (variant === "plain") {
    return (
      <p key={current.id} className={`animate-fade-up text-pretty text-muted ${className}`} aria-live="polite">
        {current.text}
      </p>
    );
  }

  if (variant === "bar") {
    return (
      <div className={`flex items-start gap-3 rounded-2xl bg-subtle px-4 py-3 text-sm ${className}`} {...hover}>
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warm" aria-hidden />
        <p key={current.id} className="animate-fade-up min-w-0 text-pretty text-ink-2" aria-live="polite">
          <span className="font-semibold text-ink">{label}.</span> {current.text}
          {plantLink}
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Plant insight" className={`py-2 ${className}`} {...hover}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-warm">
        <Lightbulb className="size-4" aria-hidden />
        {label}
        <span className="relative ml-2 h-px w-16 overflow-hidden bg-line" aria-hidden>
          {!paused && (
            <span
              key={current.id}
              className="absolute inset-0 origin-left bg-warm"
              style={{ animation: `progress ${interval}ms linear both` }}
            />
          )}
        </span>
      </div>
      <p
        key={current.id}
        className="animate-fade-up mt-3 max-w-3xl text-pretty text-2xl font-semibold leading-snug tracking-tight md:text-[2rem] md:leading-[1.25]"
        aria-live="polite"
      >
        {current.text}
        {plant && <span className="text-lg md:text-xl">{plantLink}</span>}
      </p>
    </section>
  );
}
