"use client";

import { MONTHS_SHORT } from "./labels";

export function MonthSlider({ month, onChange }: { month: number; onChange: (m: number) => void }) {
  const now = new Date().getMonth() + 1;
  return (
    <div>
      <input
        type="range"
        min={1}
        max={12}
        step={1}
        value={month}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Month"
        className="h-8 w-full cursor-pointer accent-[var(--warm)]"
      />
      <div className="-mt-1 flex justify-between text-[10px] font-medium text-muted">
        {MONTHS_SHORT.map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(i + 1)}
            aria-label={`Show ${m}`}
            className={`h-8 w-6 text-center ${i + 1 === month ? "font-bold text-ink" : ""} ${i + 1 === now ? "underline underline-offset-2" : ""}`}
          >
            {m[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
