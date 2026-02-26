"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/** 플로팅 테마 토글 (우측 하단 고정) */
export function FloatingThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // next-themes: 첫 방문 시 localStorage에 theme이 없으면 명시적 설정 (setTheme 첫 호출 이슈 회피)
  React.useEffect(() => {
    if (!mounted || !setTheme) return;
    const stored = typeof window !== "undefined" && localStorage.getItem("bioinsight-theme");
    if (!stored) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, [mounted, setTheme]);

  const handleToggle = () => {
    const current = resolvedTheme ?? theme ?? "light";
    const nextTheme = current === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const buttonClass =
    "fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full shadow-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:scale-110 transition-transform";

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={buttonClass}
        disabled
        aria-label="테마 로딩 중"
      >
        <Sun className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggle}
      aria-label={(resolvedTheme ?? theme) === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className={buttonClass}
    >
      <Sun className="h-6 w-6 dark:hidden text-amber-500" />
      <Moon className="hidden dark:block h-6 w-6 text-blue-400" />
    </Button>
  );
}
