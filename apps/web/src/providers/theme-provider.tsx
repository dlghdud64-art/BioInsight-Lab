"use client";

import * as React from "react";

/**
 * Light-only app — 운영형 workbench 톤.
 * dark class 를 제거하고 light 를 강제한다.
 */
export function ThemeProvider({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  React.useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("dark");
    el.classList.add("light");
    el.style.colorScheme = "light";
  }, []);
  return <>{children}</>;
}

// Stub for any code that imports useTheme
export function useTheme() {
  return {
    theme: "light" as const,
    resolvedTheme: "light" as const,
    setTheme: () => {},
    themes: ["light"],
    systemTheme: "light" as const,
  };
}
