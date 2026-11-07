"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "gh:theme";
const BG = { light: "#ffffff", dark: "#0b0b0b" } as const;
type Theme = keyof typeof BG;

/** Runs in <head> before first paint so a saved theme never flashes the wrong colours. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function current(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BG[theme]));
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

/** Light/dark switch. Starts from the device setting; a tap pins the other theme. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setTheme(current()));
    return () => clearTimeout(id);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setTheme(next);
      }}
      aria-label={theme ? `Switch to ${next} mode` : "Switch colour theme"}
      title={theme ? `Switch to ${next} mode` : undefined}
      className={`grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-subtle ${className}`}
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
