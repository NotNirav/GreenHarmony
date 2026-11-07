"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Lightbulb, X } from "lucide-react";
import { randomInsight } from "@/lib/insights";
import type { Insight } from "@/lib/types";

const SHOW_MS = 5000;
/** Show a toast on at most every Nth navigation so it never becomes noise. */
const EVERY_N = 2;

/** Page-turn insight: a small toast that appears briefly after client-side navigation. */
export function RouteInsightToast() {
  const pathname = usePathname();
  // Compare against the previous path (not a "first run" flag) so StrictMode's
  // double-invoked effects in dev don't count the initial load as a navigation.
  const prevPath = useRef(pathname);
  const count = useRef(0);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loadingBar, setLoadingBar] = useState(false);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    count.current += 1;
    const show = count.current % EVERY_N === 1;
    // Deferred so the state updates happen outside the effect body. Not cancelled on cleanup:
    // a re-run for the same path returns early above and must not swallow this navigation.
    setTimeout(() => {
      setLoadingBar(true);
      if (show) setInsight(randomInsight("transition", new Date().getMonth() + 1));
    });
  }, [pathname]);

  // Timers live in their own effects so they always pair with the state they reset.
  useEffect(() => {
    if (!loadingBar) return;
    const t = setTimeout(() => setLoadingBar(false), 600);
    return () => clearTimeout(t);
  }, [loadingBar]);

  useEffect(() => {
    if (!insight) return;
    const t = setTimeout(() => setInsight(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [insight]);

  return (
    <>
      {loadingBar && (
        <div
          className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-accent"
          style={{ animation: "progress 0.6s ease-out both" }}
          aria-hidden
        />
      )}
      {insight && (
        <div
          role="status"
          className="animate-fade-up fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-start gap-3 rounded-2xl bg-ink py-3 pl-4 pr-2 text-sm text-bg shadow-float md:bottom-6 md:left-auto md:right-6 md:mx-0"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warm" aria-hidden />
          <p className="flex-1 text-pretty leading-snug">{insight.text}</p>
          <button
            type="button"
            onClick={() => setInsight(null)}
            className="grid size-6 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100"
            aria-label="Dismiss tip"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}
