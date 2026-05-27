/**
 * Request Draft Header Density — AI surface 유무에 따른 center header spacing 결정
 *
 * 고정 규칙:
 * 1. suggestion 부재가 기본 상태. compact rhythm이 default.
 * 2. suggestion visible일 때만 normal spacing 적용.
 * 3. hidden reason에 관계없이 동일한 no-surface/no-copy 처리.
 * 4. empty state placeholder / AI 부재 안내 문구 금지.
 * 5. right rail / bottom dock은 AI 유무와 무관하게 불변.
 */

// ── Types ──

export type HeaderGap = "compact" | "normal";

export interface RequestDraftHeaderDensity {
  /** header title → form/suggestion 사이 간격 */
  headerBottomGap: HeaderGap;
  /** suggestion card → form 시작점 간격 (suggestion 없으면 header → form 직결) */
  formStartGap: HeaderGap;
  /** suggestion card 위 divider 노출 여부 */
  showSuggestionDivider: boolean;
}

// ── Selector ──

export function getRequestDraftHeaderDensity(input: {
  hasVisibleSuggestion: boolean;
  hasStatusChip: boolean;
}): RequestDraftHeaderDensity {
  const { hasVisibleSuggestion } = input;

  if (hasVisibleSuggestion) {
    return {
      headerBottomGap: "normal",
      formStartGap: "normal",
      showSuggestionDivider: true,
    };
  }

  // suggestion 없음 = 기본 상태. compact rhythm.
  return {
    headerBottomGap: "compact",
    formStartGap: "compact",
    showSuggestionDivider: false,
  };
}

// ── Suggestion Surface Render Decision ──

export function shouldRenderRequestDraftSuggestionSurface(params: {
  suggestionExists: boolean;
  gateIsVisible: boolean;
  previewItemCount: number;
}): boolean {
  return (
    params.suggestionExists &&
    params.gateIsVisible &&
    params.previewItemCount > 0
  );
}

// ── Tailwind class mapping ──

export function getHeaderDensityClasses(density: RequestDraftHeaderDensity): {
  headerBottomClass: string;
  formStartClass: string;
} {
  return {
    headerBottomClass: density.headerBottomGap === "compact" ? "mb-2" : "mb-3",
    formStartClass: density.formStartGap === "compact" ? "mt-2" : "mt-3",
  };
}
