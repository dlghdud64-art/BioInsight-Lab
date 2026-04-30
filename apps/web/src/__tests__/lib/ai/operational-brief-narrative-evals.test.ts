/**
 * §11.166 #operational-brief-llm-evals
 *
 * Golden output 비교 평가 harness — `generateBriefNarrative` 의 deterministic
 * fallback path 가 LabAxis 운영 OS 5 surface 시나리오 별 1문장 정합 검증.
 *
 * Why deterministic only:
 *   - LLM (Anthropic) path 는 mock 만으로 평가 가능 (sandbox + CI 비용 0).
 *   - deterministic fallback 이 prod 의 graceful degradation path — 항상 활성.
 *   - LLM golden case 별도 필요 시 `#operational-brief-llm-prompt-multilingual`
 *     트랙에서 LLM mock 으로 확장.
 *
 * Eval 분기:
 *   1. 5 LabAxis surface 시나리오 (purchase/quote/inventory/work-queue/inbox)
 *   2. deterministicNarrative 7 분기 (status only / status+blocker / blocker
 *      "차단 없음" 생략 / status+nextAction / 3-field full / blocker only /
 *      nextAction only / empty / numeric status)
 *
 * 회귀 0 보장:
 *   - 각 golden case 의 expected output 문자열 정확 매칭.
 *   - 출력 길이 ≤ 60자 (40자 cap + 약간 여유 — deterministic 은 cap 미적용).
 *   - status 원문 보존 (LabAxis canonical truth 강력 마커).
 */

import { describe, it, expect } from "vitest";
import { generateBriefNarrative, type BriefNarrativeFacts } from "@/lib/ai/operational-brief-narrative";

interface GoldenCase {
  label: string;
  input: BriefNarrativeFacts;
  expected: string;
  /** status 원문 보존 검증 (LabAxis canonical truth) */
  statusToken?: string;
}

/**
 * 5 LabAxis surface 시나리오 + deterministic 분기 골든 케이스.
 * 각 케이스는 `OPERATIONAL_BRIEF_USE_LLM` env 미설정 시 deterministic path 호출.
 */
const GOLDEN_CASES: GoldenCase[] = [
  // ─── 5 LabAxis surface 시나리오 ───
  {
    label: "purchase: 검토 필요 + 차단 없음 + 회신 확인",
    input: { status: "검토 필요", blocker: "차단 없음", nextAction: "공급사 회신 확인" },
    expected: "현재 상태: 검토 필요 · 다음 조치 — 공급사 회신 확인",
    statusToken: "검토 필요",
  },
  {
    label: "quote: 발주 가능 + 공급사 미회신 + 재요청 발송",
    input: { status: "발주 가능", blocker: "공급사 미회신", nextAction: "재요청 발송" },
    expected: "현재 상태: 발주 가능 · 차단 — 공급사 미회신 · 다음 조치 — 재요청 발송",
    statusToken: "발주 가능",
  },
  {
    label: "inventory: 안정 + 차단 없음 + 정상 운영",
    input: { status: "안정", blocker: "차단 없음", nextAction: "정상 운영" },
    expected: "현재 상태: 안정 · 다음 조치 — 정상 운영",
    statusToken: "안정",
  },
  {
    label: "work-queue: 차단됨 + 외부 승인 대기 + approver 알림",
    input: { status: "차단됨", blocker: "외부 승인 대기", nextAction: "approver 알림" },
    expected: "현재 상태: 차단됨 · 차단 — 외부 승인 대기 · 다음 조치 — approver 알림",
    statusToken: "차단됨",
  },
  {
    label: "inbox: 긴급 + 48시간 미응답 + 에스컬레이션",
    input: { status: "긴급", blocker: "48시간 미응답", nextAction: "에스컬레이션" },
    expected: "현재 상태: 긴급 · 차단 — 48시간 미응답 · 다음 조치 — 에스컬레이션",
    statusToken: "긴급",
  },
  // ─── deterministicNarrative 분기 별 ───
  {
    label: "branch: status only",
    input: { status: "READY" },
    expected: "현재 상태: READY",
    statusToken: "READY",
  },
  {
    label: "branch: blocker '차단 없음' 생략",
    input: { status: "X", blocker: "차단 없음" },
    expected: "현재 상태: X",
  },
  {
    label: "branch: blocker only",
    input: { blocker: "예산 초과" },
    expected: "차단 — 예산 초과",
  },
  {
    label: "branch: nextAction only",
    input: { nextAction: "정리" },
    expected: "다음 조치 — 정리",
  },
  {
    label: "branch: empty facts",
    input: {},
    expected: "",
  },
  {
    label: "branch: numeric status",
    input: { status: 42, blocker: "차단 없음", nextAction: "정리" },
    expected: "현재 상태: 42 · 다음 조치 — 정리",
    statusToken: "42",
  },
];

describe("§11.166 narrative evals — deterministic golden cases", () => {
  // env guard — LLM path 비활성 (golden 검증은 deterministic 만)
  const original = process.env.OPERATIONAL_BRIEF_USE_LLM;
  delete process.env.OPERATIONAL_BRIEF_USE_LLM;

  for (const c of GOLDEN_CASES) {
    it(`golden: ${c.label}`, async () => {
      const out = await generateBriefNarrative(c.input);
      expect(out).toBe(c.expected);

      // status 원문 보존 검증 (LabAxis canonical truth)
      if (c.statusToken) {
        expect(out).toContain(c.statusToken);
      }

      // 길이 sanity check (deterministic 은 cap 미적용이지만 60자 이내 권장)
      expect(out.length).toBeLessThanOrEqual(60);
    });
  }

  it("eval harness 자체 정합 — golden case 11건 이상", () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(11);
  });

  it("status 원문 보존 검증 마커가 5 surface 시나리오 모두 포함", () => {
    const surfaceCases = GOLDEN_CASES.slice(0, 5);
    for (const c of surfaceCases) {
      expect(c.statusToken).toBeDefined();
    }
  });

  // env restore
  if (original) process.env.OPERATIONAL_BRIEF_USE_LLM = original;
});
