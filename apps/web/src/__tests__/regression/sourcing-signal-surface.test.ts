/**
 * Phase 1 (RED) — 소싱 inline 신호 + compare 단계 게이트 계약
 * PLAN_ai-stage-gate-inline-signal / §1-3 · §1-4.
 *
 * ⚠️ Phase 1: helper 스캐폴드(빈 결과)라 본 테스트는 의도적 FAIL(RED). Phase 2에서 GREEN.
 *    sandbox vitest 실행 불가 → 클로드코드 실제 실행 PASS 확정.
 */
import { describe, it, expect } from "vitest";
import {
  deriveRowBlockers,
  pickTopBanner,
  evaluateCompareStage,
} from "@/lib/ai/sourcing-signal-surface";
import type { SearchSummaryLine } from "@/lib/ai/suggestion-engine";

describe("deriveRowBlockers — 행 inline blocker chip", () => {
  it("납기 미확인 → lead-time-unknown chip", () => {
    const chips = deriveRowBlockers({ hasLeadTime: false, hasQuote: true, hasSafetyInfo: true });
    expect(chips.map((c) => c.key)).toContain("lead-time-unknown");
  });

  it("견적 없음 → quote-needed chip", () => {
    const chips = deriveRowBlockers({ hasLeadTime: true, hasQuote: false, hasSafetyInfo: true });
    expect(chips.map((c) => c.key)).toContain("quote-needed");
  });

  it("안전정보 없음 → safety-info-missing chip", () => {
    const chips = deriveRowBlockers({ hasLeadTime: true, hasQuote: true, hasSafetyInfo: false });
    expect(chips.map((c) => c.key)).toContain("safety-info-missing");
  });

  it("전부 충족 → chip 0", () => {
    const chips = deriveRowBlockers({ hasLeadTime: true, hasQuote: true, hasSafetyInfo: true });
    expect(chips).toHaveLength(0);
  });

  it("chip 라벨/톤 부여(dead label 금지)", () => {
    const chips = deriveRowBlockers({ hasLeadTime: false, hasQuote: false, hasSafetyInfo: false });
    expect(chips.length).toBeGreaterThanOrEqual(3);
    for (const c of chips) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(["caution", "info"]).toContain(c.tone);
    }
  });
});

describe("pickTopBanner — 상단 우선 배너 1개", () => {
  const lines: SearchSummaryLine[] = [
    { text: "정보", signal: "info" },
    { text: "납기 확인 필요 · 3개", signal: "caution" },
    { text: "비교 권장 · 후보 4개", signal: "compare" },
  ];

  it("최우선 신호(caution) 1건 반환", () => {
    const top = pickTopBanner(lines);
    expect(top?.signal).toBe("caution");
  });

  it("빈 입력 → null", () => {
    expect(pickTopBanner([])).toBeNull();
  });

  it("info 만 있으면 info 반환(1건)", () => {
    const top = pickTopBanner([{ text: "정보", signal: "info" }]);
    expect(top?.signal).toBe("info");
  });
});

describe("evaluateCompareStage — 2단계 게이트(§1-4)", () => {
  it("가격·납기 ≥2건 → post-quote + AI 비교 분석 활성", () => {
    const r = evaluateCompareStage(2);
    expect(r.stage).toBe("post-quote");
    expect(r.canAiAnalyze).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("2건 미만 → pre-quote + 비활성 + 사유", () => {
    const r = evaluateCompareStage(1);
    expect(r.stage).toBe("pre-quote");
    expect(r.canAiAnalyze).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("0건 → pre-quote 비활성", () => {
    const r = evaluateCompareStage(0);
    expect(r.canAiAnalyze).toBe(false);
  });
});
