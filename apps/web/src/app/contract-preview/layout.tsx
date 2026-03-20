"use client";

import { useEffect } from "react";
import { OpsStoreProvider } from "@/lib/ops-console/ops-store";
import { setFlagOverrides, PREVIEW_FLAGS, resetFlagOverrides } from "@/lib/feature-flags";

/**
 * Contract Preview Layout
 *
 * 계약 작업 전용 격리 레이아웃.
 * - 기본 /app/dashboard와 완전 분리
 * - OpsStoreProvider 자체 제공
 * - feature flag를 PREVIEW 모드로 override
 * - 기본 shell/sidebar/nav 오염 없음
 */
export default function ContractPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    setFlagOverrides(PREVIEW_FLAGS);
    return () => resetFlagOverrides();
  }, []);

  return (
    <OpsStoreProvider>
      <div className="min-h-screen bg-slate-950">
        <div className="sticky top-0 z-50 bg-amber-600 text-white text-xs text-center py-1 font-medium">
          ⚠ Contract Preview — 기본 대시보드에 반영되지 않습니다
        </div>
        {children}
      </div>
    </OpsStoreProvider>
  );
}
