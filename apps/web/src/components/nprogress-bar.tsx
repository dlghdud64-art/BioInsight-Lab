"use client";

/**
 * §11.246d-2 #nprogress-page-transition — 호영님 P0 성능 #10 페이지 전환 NProgress 바
 *
 * 호영님 spec:
 *   - 페이지 navigation 시 상단 progress bar 노출 (다른 사이트들도 이런 UX 다 적용)
 *   - 사용자에게 "페이지가 전환되고 있다" 즉시 피드백 → "클릭이 안 됐나?" 의심 차단
 *
 * Stack:
 *   - next-nprogress-bar (App Router 호환, ~5KB)
 *   - LabAxis 브랜드 정합 색상: indigo-500 (#6366f1) — 대시보드 KPI 톤
 *   - 높이 4px (표준)
 *   - options.showSpinner: false — 라우터 transition bar 만 (spinner 노이즈 0)
 *   - shallowRouting — App Router shallow nav 정합
 *
 * 모바일 영향 0:
 *   - 본 컴포넌트는 web layout.tsx 만 사용
 *   - RN/Expo Router 는 자체 transition feedback 보유
 *
 * canonical truth lock:
 *   - schema 0 / migration 0 / mutation 0
 *   - layout.tsx Provider stack 시그니처 변경 0
 *   - children 위치 변경 0
 */

import { AppProgressBar } from "next-nprogress-bar";

export function NProgressBar() {
  return (
    <AppProgressBar
      height="4px"
      color="#6366f1"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
