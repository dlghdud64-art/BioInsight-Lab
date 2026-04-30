/**
 * §11.167 #operational-brief-llm-fallback-on-token-loss
 *
 * `validateNarrativeFitness()` + LLM path 의 token loss 시 자동 deterministic
 * fallback 검증. LLM hallucination (status overwrite / blocker omission) 차단.
 *
 * §11.142 lock — facts canonical truth 보호 강력 layer:
 *   - prompt level (§11.165): "facts 원문 보존" instruction
 *   - test level (§11.166): statusToken 검증 (eval harness)
 *   - **lib level (§11.167)**: validateNarrativeFitness + 자동 fallback (본 트랙)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateBriefNarrative,
  validateNarrativeFitness,
} from "@/lib/ai/operational-brief-narrative";

vi.mock("@/lib/ai/anthropic", () => ({
  callAnthropicMessage: vi.fn(),
}));

import { callAnthropicMessage } from "@/lib/ai/anthropic";

describe("§11.167 validateNarrativeFitness — pure function", () => {
  it("status 포함된 narrative → true", () => {
    expect(validateNarrativeFitness(
      "현재 상태: 검토 필요 입니다.",
      { status: "검토 필요" },
    )).toBe(true);
  });

  it("status 누락된 narrative (hallucination) → false", () => {
    expect(validateNarrativeFitness(
      "확인 중이며 다음 조치 진행합니다.",
      { status: "검토 필요" },
    )).toBe(false);
  });

  it("blocker truthy + narrative 누락 → false", () => {
    expect(validateNarrativeFitness(
      "현재 상태: 검토 필요 입니다.",
      { status: "검토 필요", blocker: "공급사 미회신" },
    )).toBe(false);
  });

  it("blocker '차단 없음' 누락 OK → true", () => {
    expect(validateNarrativeFitness(
      "현재 상태: 안정 · 정상 운영 중.",
      { status: "안정", blocker: "차단 없음", nextAction: "정상 운영" },
    )).toBe(true);
  });

  it("nextAction 동의어 사용 OK → true (검증 X)", () => {
    expect(validateNarrativeFitness(
      "현재 상태: 검토 필요 · 회신 받기.",
      { status: "검토 필요", nextAction: "공급사 회신 확인" },
    )).toBe(true);
  });

  it("status null + narrative 무관 → true", () => {
    expect(validateNarrativeFitness(
      "안정 운영.",
      { nextAction: "정리" },
    )).toBe(true);
  });
});

describe("§11.167 generateBriefNarrative — LLM token loss fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
  });

  it("LLM 정상 응답 (status 포함) → LLM 결과 사용", async () => {
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
  });

  it("LLM 응답이 status 누락 (hallucination) → deterministic fallback", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "확인 중이며 회신 진행합니다.", // "검토 필요" 누락
      inputTokens: 10,
      outputTokens: 8,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({
      status: "검토 필요",
      blocker: "차단 없음",
      nextAction: "공급사 회신 확인",
    });
    // deterministic fallback path
    expect(out).toContain("현재 상태: 검토 필요");
    expect(out).toContain("다음 조치 — 공급사 회신 확인");
  });

  it("LLM 응답이 blocker 누락 (truthy) → deterministic fallback", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "발주 가능 상태입니다.", // "공급사 미회신" 누락
      inputTokens: 10,
      outputTokens: 5,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({
      status: "발주 가능",
      blocker: "공급사 미회신",
      nextAction: "재요청 발송",
    });
    expect(out).toContain("차단 — 공급사 미회신");
  });

  it("LLM 응답 빈 문자열 → deterministic fallback (선재 §11.153)", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "  ",
      inputTokens: 1,
      outputTokens: 0,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({ status: "X" });
    expect(out).toContain("현재 상태: X");
  });

  it("LLM 응답 throw → deterministic fallback (선재 §11.153)", async () => {
    vi.mocked(callAnthropicMessage).mockRejectedValue(new Error("API down"));
    const out = await generateBriefNarrative({ status: "Y", blocker: "z", nextAction: "n" });
    expect(out).toContain("현재 상태");
  });
});
