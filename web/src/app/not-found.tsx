import Link from "next/link";
import { EmptyState } from "@/components/insights/EmptyState";
import { stats } from "@/lib/data";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <EmptyState
        asPage
        title="This page didn't sprout"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
              Go home
            </Link>
            <Link href="/plants/" className="rounded-full bg-subtle px-5 py-2.5 text-sm font-semibold">
              Browse {stats.plants} plants
            </Link>
          </div>
        }
      />
    </div>
  );
}
