/**
 * LabAxis Color System v1
 * ─────────────────────────────────────────────────
 * 모든 화면의 색은 아래 5개 그룹에서 파생됩니다.
 * 페이지별 감각적 판단이 아니라 역할 기준으로 선택합니다.
 *
 * ┌─ Brand Depth  ─── 로그인 좌측, 히어로, 소개·요금 상단, 푸터
 * ├─ Product Surface ─ 대시보드, 소싱, 앱 내부 화면
 * ├─ Light Bridge ──── 소개 하단, 요금 본문, CTA 구역
 * ├─ Action Blue  ──── 주요 CTA, 활성 선택 상태
 * └─ Line / Stroke ─── 구분선, 경계
 *
 * 한 줄 룰:
 *  - 브랜드를 보여줄 때 → 네이비 (Brand Depth)
 *  - 제품을 쓸 때 → 블루-차콜 (Product Surface)
 *  - 설명·설득할 때 → 블루-그레이 라이트 (Light Bridge)
 *  - 행동을 유도할 때만 → 액션 블루
 */

// ── 1. Brand Depth ──────────────────────────────
// 로그인 좌측 네이비가 기준선. 히어로·소개·요금 상단·푸터에서 공유.
export const BRAND_DEPTH = {
  900: "#071A33",  // 최심부 — 히어로 바닥, 푸터 배경
  800: "#0D2A50",  // 중심 — 로그인 좌측 주조색, 소개 상단
  700: "#173251",  // 연장 — 전이 시작점, 글래스모피즘 백드롭
} as const;

// ── 2. Product Surface ──────────────────────────
// 대시보드·소싱 차콜이 기준선. 제품 내부 전용.
// ※ navy가 눌린 블루-차콜이어야 로그인 세계관의 실무형 확장으로 읽힘.
export const PRODUCT_SURFACE = {
  900: "#1C2028",  // 쉘 — 최하층 (기존 #24282F에서 navy-tint 보강)
  800: "#252A33",  // 페이지 — 작업 영역 (기존 #2E333B에서 blue shift)
  700: "#2F3540",  // 패널 — 카드/섹션 (기존 #3A4048에서 blue shift)
  600: "#3A4150",  // 상승 — input, 검색 포커스
  500: "#455264",  // 강조 — hover, active
} as const;

// ── 3. Light Bridge ─────────────────────────────
// 소개 하단·요금 본문·CTA 구역 전용.
// 흰색이 아니라 blue-white. 브랜드 네이비에서 밝아진 확장 톤.
export const LIGHT_BRIDGE = {
  300: "#DCE5F0",  // 섹션 바탕 — 가장 눌린 라이트
  200: "#EAF1F8",  // 중간 바탕 — 표준 라이트
  100: "#F6F9FC",  // 카드 표면 — 가장 밝은 라이트 (순백 대체)
} as const;

// ── 4. Action Blue ──────────────────────────────
// CTA·선택 상태 전용. 나머지 블루 용도에는 쓰지 않음.
export const ACTION_BLUE = {
  500: "#2563EB",  // 주요 CTA
  400: "#3B82F6",  // hover/보조 CTA
  300: "#60A5FA",  // 글로우/어시스트 (제한적 사용)
} as const;

// ── 5. Line / Stroke ────────────────────────────
export const LINE = {
  subtleDark:  "rgba(255,255,255,0.08)",  // 다크 위 구분선
  subtleLight: "#D7E0EB",                 // 라이트 위 구분선
  activeDark:  "rgba(255,255,255,0.14)",  // 다크 위 활성 구분선
  activeLight: "#C0CCE0",                 // 라이트 위 활성 구분선
} as const;

// ── 6. Text (역할별) ────────────────────────────
export const BRAND_TEXT = {
  // 다크 컨텍스트
  darkPrimary:   "#D9E2F1",
  darkSecondary: "#8A97AA",
  darkMuted:     "#5F6E83",
  // 라이트 컨텍스트
  lightPrimary:   "#0F1728",
  lightSecondary: "#334155",
  lightMuted:     "#64748B",
  lightFaint:     "#94A3B8",
} as const;

// ── 전이 그라데이션 ─────────────────────────────
// 섹션 경계가 보이지 않고 밝기만 변하는 것처럼 보여야 함.

/** 다크 브랜드 씬 → 라이트 브리지 */
export const GRADIENT_DARK_TO_LIGHT = {
  height: 180,
  css: `linear-gradient(180deg,
    ${BRAND_DEPTH[900]} 0%,
    #0a2040 10%,
    #102b4a 22%,
    #1a3858 36%,
    #284868 50%,
    #3d5d7e 62%,
    #5a7896 74%,
    #7e96ae 84%,
    #a3b5c8 91%,
    #c4d0dd 96%,
    ${LIGHT_BRIDGE[300]} 100%)`,
} as const;

/** 라이트 브리지 → 푸터 네이비 */
export const GRADIENT_LIGHT_TO_FOOTER = {
  height: 100,
  css: `linear-gradient(180deg,
    ${LIGHT_BRIDGE[300]} 0%,
    #a8b8cc 18%,
    #7e92ab 36%,
    #5a7190 54%,
    #3d5574 70%,
    #253c55 84%,
    #182d45 94%,
    ${BRAND_DEPTH[900]} 100%)`,
} as const;

/** 라이트 섹션 상단 (다크 잔광) → 라이트 브리지 */
export const GRADIENT_DARK_AFTERGLOW = {
  height: 140,
  css: `linear-gradient(180deg,
    #253c55 0%,
    #334a63 8%,
    #4a5e78 20%,
    #6b7d96 36%,
    #8a9ab2 52%,
    #aab8c9 66%,
    #c4d0dd 80%,
    ${LIGHT_BRIDGE[300]} 100%)`,
} as const;

// ── 페이지군별 적용 규칙 (참조용 타입) ──────────
export type PageZone =
  | "brand-depth"    // 로그인 좌측, 히어로, 소개·요금 상단, 푸터
  | "product"        // 대시보드, 소싱, 앱 내부
  | "light-bridge";  // 소개 하단, 요금 본문, CTA

/** 주어진 존에 맞는 카드 표면 색 반환 */
export function cardSurface(zone: PageZone) {
  switch (zone) {
    case "brand-depth":    return BRAND_DEPTH[700];
    case "product":        return PRODUCT_SURFACE[800];
    case "light-bridge":   return LIGHT_BRIDGE[100];
  }
}

/** 주어진 존에 맞는 섹션 배경 색 반환 */
export function sectionBg(zone: PageZone) {
  switch (zone) {
    case "brand-depth":    return BRAND_DEPTH[800];
    case "product":        return PRODUCT_SURFACE[900];
    case "light-bridge":   return LIGHT_BRIDGE[200];
  }
}

/** 주어진 존에 맞는 구분선 색 반환 */
export function lineBorder(zone: PageZone) {
  switch (zone) {
    case "brand-depth":    return LINE.subtleDark;
    case "product":        return LINE.subtleDark;
    case "light-bridge":   return LINE.subtleLight;
  }
}
