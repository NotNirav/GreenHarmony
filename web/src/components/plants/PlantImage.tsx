"use client";

import { useState } from "react";
import { Leaf } from "lucide-react";

/**
 * Plant photo with a quiet fallback when there is no photo or it fails to load.
 * Props are deliberately flat: passing a whole plant object from a server component would
 * serialize all of it into every page.
 */
export function PlantImage({
  src,
  name,
  botanical,
  className = "",
  priority = false,
}: {
  src: string | null | undefined;
  name: string;
  botanical: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-subtle text-muted ${className}`} role="img" aria-label={name}>
        <Leaf className="size-8 opacity-40" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export; images are hot-linked CC photos
    <img
      src={src}
      alt={`${name} (${botanical})`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-subtle object-cover ${className}`}
    />
  );
}
