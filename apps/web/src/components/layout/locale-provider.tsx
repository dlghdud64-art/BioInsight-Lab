"use client";

import { useEffect } from "react";
import { useLocaleStore } from "@/lib/store/locale-store";

/**
 * 언어 설정에 따라 HTML lang 속성을 업데이트하는 컴포넌트
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <>{children}</>;
}

