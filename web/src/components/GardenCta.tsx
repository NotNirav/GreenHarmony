"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** True once we know a garden is saved on this device (false during the first render). */
export function useHasGarden(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setHas(!!localStorage.getItem("gh:garden:v1"));
      } catch {
        setHas(false);
      }
    });
    return () => clearTimeout(id);
  }, []);
  return has;
}

/** "Plan my space" for newcomers; "Open my garden" once a plan exists, so nobody restarts by accident. */
export function GardenCta({ className, newLabel = "Plan my space", existingLabel = "Open my garden" }: { className: string; newLabel?: string; existingLabel?: string }) {
  const has = useHasGarden();
  return (
    <Link href={has ? (existingLabel.startsWith("Edit") ? "/plan/?edit=1" : "/garden/") : "/plan/"} className={className}>
      {has ? existingLabel : newLabel}
    </Link>
  );
}
