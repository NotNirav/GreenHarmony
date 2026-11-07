import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/insights/EmptyState";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

export default function Offline() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <EmptyState
        asPage
        title="You're offline, but your garden isn't"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/garden/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
              Open my garden
            </Link>
            <Link href="/plants/" className="rounded-full bg-subtle px-5 py-2.5 text-sm font-semibold">
              Plants I&apos;ve viewed
            </Link>
          </div>
        }
      />
      <p className="-mt-12 pb-16 text-center text-sm text-muted">Your plan, watering and care calendar are saved on this phone. Weather updates return when you&apos;re back online.</p>
    </div>
  );
}
