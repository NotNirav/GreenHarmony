"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <Icon className={`size-[22px] ${active ? "text-accent" : ""}`} aria-hidden strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
