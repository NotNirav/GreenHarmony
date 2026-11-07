"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { randomInsight } from "@/lib/insights";

export function EmptyState({ title, action, asPage = false }: { title: string; action?: React.ReactNode; asPage?: boolean }) {
  const Heading = asPage ? "h1" : "h3";
  const [text, setText] = useState("Every garden starts with a single seed.");
  useEffect(() => {
    const id = setTimeout(() => setText(randomInsight("empty", new Date().getMonth() + 1).text));
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <Heading className={`${asPage ? "text-2xl md:text-3xl" : "text-xl"} font-bold tracking-tight`}>{title}</Heading>
      <p className="mt-3 flex max-w-sm items-start gap-2 text-pretty text-muted">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warm" aria-hidden />
        {text}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
