import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="GreenHarmony home">
      <svg viewBox="0 0 24 24" className="size-6 text-accent" fill="currentColor" aria-hidden>
        <path d="M11.2 21.5v-6.3C6.4 15 3 11.6 3 6.6V4.5h1.6c3.3 0 5.8 1.5 7 4 1.4-3.3 4.4-5.3 8.2-5.3H21v2.2c0 5.6-3.7 9.3-8.8 9.7v6.4h-1Z" />
      </svg>
      <span className="text-[17px] font-bold tracking-tight text-ink">GreenHarmony</span>
    </Link>
  );
}
