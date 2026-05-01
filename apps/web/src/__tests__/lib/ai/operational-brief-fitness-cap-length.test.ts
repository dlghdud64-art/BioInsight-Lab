/**
 * §11.169 #operational-brief-llm-fitness-cap-length
 *
 * `validateNarrativeFitness()` length cap (60자) + `generateBriefNarrative`
 * LLM path 가 verbose 응답 시 deterministic fallback.
 *
 * Why 60자:
 *   - prompt (§11.165) 의 "40자 이내" + 한국어 어미/조사 가변성 + 약간 여유.
 *   - 운영 브리핑 § 1 상황 요약 row 가 1줄 (모바일 ~40자, 데스크톱 ~80자) — 60자
 *     가 cross-surface 안전 cap.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateNarrativeFitness,
  generateBriefNarrative,
  NARRATIVE_LENGTH_CAP,
} from "@/lib/ai/operational-brief-narrative";
import {
  resetBriefCacheStats,
  getBriefCacheStats,
} from "@/lib/ai/operational-brief-cache-metrics";

vi.mock("@/lib/ai/anthropic", () => ({
  callAnthropicMessage: vi.fn(),
}));

import { callAnthropicMessage } from "@/lib/ai/anthropic";

describe("§11.169 length cap — pure validateNarrativeFitness", () => {
  it("NARRATIVE_LENGTH_CAP 상수 60자 export", () => {
    expect(NARRATIVE_LENGTH_CAP).toBe(60);
  });

  it("정상 길이 (≤60자) → true", () => {
    const ok = "검토 필요 상태이며 회신 확인 중.";
    expect(ok.length).toBeLessThanOrEqual(60);
    expect(validateNarrativeFitness(ok, { status: "검토 필요" })).toBe(true);
  });

  it("정확 60자 경계 → true (cap inclusive)", () => {
    const sixty = "검토 필요 " + "X".repeat(54); // "검토 필요 " (5) + 55 X = 60
    expect(sixty.length).toBe(60);
    expect(validateNarrativeFitness(sixty, { status: "검토 필요" })).toBe(true);
  });

  it("61자 (cap 초과) → false", () => {
    const overflow = "검토 필요 " + "X".repeat(56);
    expect(overflow.length).toBeGreaterThan(60);
    expect(validateNarrativeFitness(overflow, { status: "검토 필요" })).toBe(false);
  });

  it("LLM verbose 응답 (1000자 hallucination) → false", () => {
    const verbose = "검토 필요 " + "추가 설명 ".repeat(100);
    expect(validateNarrativeFitness(verbose, { status: "검토 필요" })).toBe(false);
  });

  it("선재 §11.167 status 누락 검증 보존", () => {
    expect(validateNarrativeFitness("확인 중.", { status: "검토 필요" })).toBe(false);
  });
});

describe("§11.169 generateBriefNarrative — LLM verbose response fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBriefCacheStats();
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
  });

  it("LLM verbose (60자 초과) → deterministic fallback + fitness_fail increment", async () => {
    const verbose = "검토 필요 상태이며 공급사 회신 확인 중이고 추가로 운영 정보를 더 자세히 설명하며 다음 조치 진행하는 중입니다 매우 길게.";
    expect(verbose.length).toBeGreaterThan(60);
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: verbose,
      inputTokens: 10,
      outputTokens: 30,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({
      status: "검토 필요",
      blocker: "차단 없음",
      nextAction: "공급사 회신 확인",
    });
    // deterministic fallback
    expect(out).toContain("현재 상태: 검토 필요");
    expect(out.length).toBeLessThanOrEqual(80); // deterministic 도 일반적으로 짧음
    expect(getBriefCacheStats().fitness_fail).toBe(1);
  });

  it("LLM 정상 (≤60자, status 포함) → fitness_pass", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "검토 필요 상태이며 회신 확인 중.",
      inputTokens: 10,
      outputTokens: 8,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({
      status: "검토 필요",
      blocker: "차단 없음",
      nextAction: "공급사 회신 확인",
    });
    expect(out).toBe("검토 필요 상태이며 회신 확인 중.");
    expect(getBriefCacheStats().fitness_pass).toBe(1);
    expect(getBriefCacheStats().fitness_fail).toBe(0);
  });
});
