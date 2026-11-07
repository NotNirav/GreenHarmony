"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { GardenCta } from "./GardenCta";
import { NAV, isActive } from "./nav";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 md:h-16 md:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`py-1 text-sm transition-colors ${
                  active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <ThemeToggle className="-mx-3" />
          <GardenCta
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-85"
            existingLabel="Edit my space"
          />
        </nav>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Link href="/plants/" className="grid size-9 place-items-center rounded-full text-ink" aria-label="Search plants">
            <Search className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
