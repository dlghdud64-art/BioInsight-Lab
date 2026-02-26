"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

const MOBILE_BREAKPOINT = 768;
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth < MOBILE_BREAKPOINT || MOBILE_UA.test(navigator.userAgent)
  );
}

/** 모바일 접속 시 저장된 테마가 없으면 라이트 모드 강제 */
function MobileThemeEnforcer({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const enforced = React.useRef(false);

  React.useEffect(() => {
    if (enforced.current) return;
    const stored = localStorage.getItem("bioinsight-theme");
    if (isMobile() && !stored) {
      setTheme("light");
      enforced.current = true;
    }
  }, [setTheme]);

  return <>{children}</>;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="bioinsight-theme"
      {...props}
    >
      <MobileThemeEnforcer>{children}</MobileThemeEnforcer>
    </NextThemesProvider>
  );
}


