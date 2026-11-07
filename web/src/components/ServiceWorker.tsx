"use client";

import { useEffect } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __ghInstall?: InstallPromptEvent | null;
  }
}

/** Registers /sw.js (production only) and keeps the browser's install prompt for <InstallApp />. */
export function ServiceWorker() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__ghInstall = e as InstallPromptEvent;
      window.dispatchEvent(new Event("gh:installable"));
    };
    const onInstalled = () => {
      window.__ghInstall = null;
      window.dispatchEvent(new Event("gh:installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          // Hand over what this first page load already fetched so it also works offline.
          const urls = performance.getEntriesByType("resource").map((r) => r.name);
          reg.active?.postMessage({ type: "cache-urls", urls });
        })
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
