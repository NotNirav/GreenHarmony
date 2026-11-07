"use client";

import { Minus, Plus } from "lucide-react";

export function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold">{title}</h3>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  multi = false,
  max,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T | T[];
  onChange: (v: T | T[]) => void;
  multi?: boolean;
  max?: number;
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const click = (v: T) => {
    if (!multi) return onChange(v);
    const arr = value as T[];
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
    else if (!max || arr.length < max) onChange([...arr, v]);
    else onChange([...arr.slice(1), v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => click(o.value)}
          aria-pressed={selected(o.value)}
          className={`rounded-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
            selected(o.value) ? "bg-ink text-bg" : "bg-subtle text-ink-2 hover:bg-subtle-2"
          }`}
        >
          {o.label}
          {o.sub && <span className={`ml-1.5 font-normal ${selected(o.value) ? "opacity-70" : "text-muted"}`}>{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Cards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; sub: string; icon: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex flex-col items-start gap-3 rounded-2xl p-4 text-left ring-1 transition ${
              active ? "bg-ink text-bg ring-ink" : "bg-bg ring-line hover:ring-ink-2"
            }`}
          >
            <span className={active ? "text-bg" : "text-accent"}>{o.icon}</span>
            <span>
              <span className="block font-bold">{o.label}</span>
              <span className={`block text-xs ${active ? "opacity-75" : "text-muted"}`}>{o.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v: number) => String(v),
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) / step) * step);
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => set(value - step)} className="grid size-11 place-items-center rounded-full bg-subtle hover:bg-subtle-2" aria-label={`Less ${label}`}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-20 text-center text-2xl font-extrabold tabular-nums tracking-tight" aria-live="polite">
        {format(value)}
      </span>
      <button type="button" onClick={() => set(value + step)} className="grid size-11 place-items-center rounded-full bg-subtle hover:bg-subtle-2" aria-label={`More ${label}`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "m",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xl font-extrabold tabular-nums tracking-tight">
          {value.toFixed(step < 1 ? 1 : 0)} <span className="text-sm font-semibold text-muted">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--ink)]"
      />
    </label>
  );
}

export function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-subtle-2"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-bg shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
