"use client";

import { useEffect } from "react";

export function ScrollResetOnLoad() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const navigationEntry = window.performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const legacyNavigation = window.performance as Performance & {
      navigation?: { type?: number };
    };
    const isReload =
      navigationEntry?.type === "reload" ||
      legacyNavigation.navigation?.type === 1;

    if (!isReload) {
      return;
    }

    const forceScrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    forceScrollTop();
    requestAnimationFrame(() => {
      requestAnimationFrame(forceScrollTop);
    });

    window.addEventListener("load", forceScrollTop, { once: true });

    return () => {
      window.removeEventListener("load", forceScrollTop);
    };
  }, []);

  return null;
}
