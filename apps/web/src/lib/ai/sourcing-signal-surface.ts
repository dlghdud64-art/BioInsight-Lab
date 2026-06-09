/**
 * 소싱 AI surface — inline 신호 + 단계 게이트 (PLAN_ai-stage-gate-inline-signal, §1-3/§1-4)
 *
 * "AI 분석" 버튼·패널(별도 surface)을 제거하고 동일 신호를 행 inline blocker chip +
 * 상단 우선 배너 1개로 전환. compare는 2단계 게이트(pre-quote 스펙비교 / post-quote
 * 가격·납기 AI 비교 분석). 엔진(generateSearchSummary)은 룰 기반이라 그대로 재사용,
 * 본 모듈은 그 출력/제품 필드를 inline surface 형태로 매핑하는 순수 helper.
 *
 * Phase 2 — 규칙 본체 구현.
 */
import type { SearchSummaryLine } from "@/lib/ai/suggestion-engine";

/* ── 행 inline blocker chip (§1-3: 납기 미확인·견적 필요·안전정보 없음) ── */
export type SourcingBlockerKey =
  | "lead-time-unknown"
  | "quote-needed"
  | "safety-info-missing";

export interface SourcingBlockerChip {
  key: SourcingBlockerKey;
  label: string;
  tone: "caution" | "info";
}

/** 행 1개의 blocker 판정 입력(제품 raw 가 아니라 정규화된 boolean — 순수·테스트 가능). */
export interface RowBlockerInput {
  hasLeadTime: boolean;
  hasQuote: boolean;
  hasSafetyInfo: boolean;
}

/** 상단 우선 배너 신호 우선순위(높을수록 우선). */
export type CompareStage = "pre-quote" | "post-quote";

export interface CompareStageResult {
  stage: CompareStage;
  /** 가격·납기 보유 후보 ≥2건일 때만 "AI 비교 분석" 활성. */
  canAiAnalyze: boolean;
  /** 비활성 사유(활성이면 null). */
  reason: string | null;
}

/**
 * 행별 blocker chip 목록(없으면 빈 배열).
 *
 * ⚠️ 3c 결정(호영님 2026-06-08): sourcing-result-row 직접 배선은 보류 — row 가 이전 배치에서
 *   "견적 필요 noise 제거"(가격/재고 0 억제)를 명시 결정했고, aggregate caution 은 상단 우선
 *   배너(pickTopBanner)가 담당하므로 행 chip 은 중복. 본 helper 는 계약·테스트로 보존(추후 행
 *   chip 재도입 시 재사용). 현재 production 직접 호출 없음(상단 배너 경로로 대체).
 */
export function deriveRowBlockers(input: RowBlockerInput): SourcingBlockerChip[] {
  const chips: SourcingBlockerChip[] = [];
  if (!input.hasLeadTime) {
    chips.push({ key: "lead-time-unknown", label: "납기 미확인", tone: "caution" });
  }
  if (!input.hasQuote) {
    chips.push({ key: "quote-needed", label: "견적 필요", tone: "info" });
  }
  if (!input.hasSafetyInfo) {
    chips.push({ key: "safety-info-missing", label: "안전정보 없음", tone: "caution" });
  }
  return chips;
}

/** 신호 우선순위(높을수록 우선). caution(차단) > compare > request > info. */
const SIGNAL_PRIORITY: Record<SearchSummaryLine["signal"], number> = {
  caution: 3,
  compare: 2,
  request: 1,
  info: 0,
};

/** 검색결과 상단 우선 배너 1개(신호 우선순위 최고 1건, 없으면 null). */
export function pickTopBanner(lines: SearchSummaryLine[]): SearchSummaryLine | null {
  if (lines.length === 0) return null;
  return lines.reduce((top, cur) =>
    SIGNAL_PRIORITY[cur.signal] > SIGNAL_PRIORITY[top.signal] ? cur : top,
  );
}

/** compare 2단계 게이트 — 가격·납기 보유 후보 수 기준. */
export function evaluateCompareStage(quoteReadyCount: number): CompareStageResult {
  const canAiAnalyze = quoteReadyCount >= 2;
  return {
    stage: canAiAnalyze ? "post-quote" : "pre-quote",
    canAiAnalyze,
    reason: canAiAnalyze ? null : "가격·납기 보유 후보 2건+ 필요",
  };
}
