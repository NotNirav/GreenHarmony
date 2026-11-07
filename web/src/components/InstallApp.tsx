"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type Mode = "hidden" | "prompt" | "ios";
const DISMISS_KEY = "gh:install-dismissed";

function detect(): Mode {
  if (typeof window === "undefined") return "hidden";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  try {
    if (localStorage.getItem(DISMISS_KEY)) return "hidden";
  } catch {
    /* storage blocked */
  }
  if (window.__ghInstall) return "prompt";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  return ios ? "ios" : "hidden";
}

/** "Add to home screen" card: a real install button on Android/desktop Chrome, instructions on iPhone Safari. */
export function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");

  useEffect(() => {
    const update = () => setMode(detect());
    update();
    window.addEventListener("gh:installable", update);
    return () => window.removeEventListener("gh:installable", update);
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
    setMode("hidden");
  };
  const install = async () => {
    const e = window.__ghInstall;
    if (!e) return;
    await e.prompt();
    await e.userChoice.catch(() => undefined);
    window.__ghInstall = null;
    setMode("hidden");
  };

  return (
    <div className="flex items-start gap-3 rounded-3xl bg-accent-soft p-4 md:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Keep your garden one tap away</p>
        {mode === "prompt" ? (
          <p className="mt-0.5 text-sm text-ink-2">Install GreenHarmony on your home screen. It opens like an app and works without internet.</p>
        ) : (
          <p className="mt-0.5 text-sm text-ink-2">
            In Safari, tap <Share className="inline size-4 align-[-3px]" aria-label="Share" /> then <span className="font-semibold">Add to Home Screen</span>.
          </p>
        )}
        {mode === "prompt" && (
          <button type="button" onClick={install} className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
            <Download className="size-4" aria-hidden /> Install app
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-full p-1.5 text-muted hover:bg-subtle">
        <X className="size-4" />
      </button>
    </div>
  );
}
