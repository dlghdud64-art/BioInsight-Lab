"use client";

import * as React from "react";

/**
 * Dark-only app — no theme switching.
 * next-themes completely removed to prevent light mode injection.
 */
export function ThemeProvider({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  React.useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("light");
    el.classList.add("dark");
    el.style.colorScheme = "dark";
  }, []);
  return <>{children}</>;
}

// Stub for any code that imports useTheme
export function useTheme() {
  return {
    theme: "dark" as const,
    resolvedTheme: "dark" as const,
    setTheme: () => {},
    themes: ["dark"],
    systemTheme: "dark" as const,
  };
}
