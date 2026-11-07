"use client";

import type { Facing } from "@/lib/space/types";
import { FACING_LABEL, FACING_SHORT } from "./labels";

const DIRS: Facing[] = [0, 45, 90, 135, 180, 225, 270, 315];

/** Pick which way the space opens to. Buttons sit around a dial; the arrow shows the choice. */
export function Compass({ value, onChange }: { value: Facing; onChange: (f: Facing) => void }) {
  const r = 108;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <div className="absolute inset-[18%] rounded-full border border-line" />
      <div className="absolute inset-[34%] grid place-items-center rounded-full bg-subtle text-center">
        <div>
          <p className="text-[11px] text-muted">Opens to the</p>
          <p className="text-lg font-extrabold tracking-tight">{FACING_LABEL[value]}</p>
        </div>
      </div>
      <svg viewBox="-150 -150 300 300" className="pointer-events-none absolute inset-0" aria-hidden>
        <g style={{ transform: `rotate(${value}deg)`, transition: "transform .35s cubic-bezier(.2,.7,.2,1)" }}>
          <line x1={0} y1={-48} x2={0} y2={-84} stroke="var(--warm)" strokeWidth={4} strokeLinecap="round" />
          <path d="M0 -94 L-8 -80 L8 -80 Z" fill="var(--warm)" />
        </g>
      </svg>
      {DIRS.map((d) => {
        const a = ((d - 90) * Math.PI) / 180;
        const x = 50 + (Math.cos(a) * r) / 3;
        const y = 50 + (Math.sin(a) * r) / 3;
        const active = d === value;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={active}
            aria-label={FACING_LABEL[d]}
            className={`absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-bold transition ${
              active ? "bg-ink text-bg" : "bg-subtle text-ink-2 hover:bg-subtle-2"
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {FACING_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}
