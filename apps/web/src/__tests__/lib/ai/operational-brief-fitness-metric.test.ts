/**
 * §11.168 #operational-brief-llm-fitness-metric
 *
 * fitness_pass / fitness_fail counter behavior + computeBriefFitnessPassRate.
 * generateBriefNarrative LLM path 가 fitness 통과/실패 별 카운터 increment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resetBriefCacheStats,
  getBriefCacheStats,
  computeBriefFitnessPassRate,
  incrementCacheStat,
} from "@/lib/ai/operational-brief-cache-metrics";
import { generateBriefNarrative } from "@/lib/ai/operational-brief-narrative";

vi.mock("@/lib/ai/anthropic", () => ({
  callAnthropicMessage: vi.fn(),
}));

import { callAnthropicMessage } from "@/lib/ai/anthropic";

describe("§11.168 fitness counter — pure", () => {
  beforeEach(() => resetBriefCacheStats());

  it("초기값 0", () => {
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(0);
    expect(s.fitness_fail).toBe(0);
  });

  it("incrementCacheStat fitness_pass / fitness_fail 동작", () => {
    incrementCacheStat("fitness_pass", 3);
    incrementCacheStat("fitness_fail", 1);
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(3);
    expect(s.fitness_fail).toBe(1);
  });

  it("computeBriefFitnessPassRate: 3 pass + 1 fail → 0.75", () => {
    incrementCacheStat("fitness_pass", 3);
    incrementCacheStat("fitness_fail", 1);
    expect(computeBriefFitnessPassRate()).toBeCloseTo(0.75, 3);
  });

  it("computeBriefFitnessPassRate: 0 total → 0 (divide-by-zero guard)", () => {
    expect(computeBriefFitnessPassRate()).toBe(0);
  });

  it("resetBriefCacheStats 가 fitness counter 도 초기화", () => {
    incrementCacheStat("fitness_pass", 5);
    resetBriefCacheStats();
    expect(getBriefCacheStats().fitness_pass).toBe(0);
  });
});

describe("§11.168 generateBriefNarrative — fitness counter wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBriefCacheStats();
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
  });

  it("LLM 정상 (status 포함) → fitness_pass increment", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "검토 필요 상태이며 회신 확인 중.",
      inputTokens: 10,
      outputTokens: 8,
      model: "claude-haiku",
    });
    await generateBriefNarrative({
      status: "검토 필요",
      blocker: "차단 없음",
      nextAction: "공급사 회신 확인",
    });
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(1);
    expect(s.fitness_fail).toBe(0);
  });

  it("LLM 응답 status 누락 (hallucination) → fitness_fail increment + fallback", async () => {
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
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(0);
    expect(s.fitness_fail).toBe(1);
    // fallback 동작도 검증
    expect(out).toContain("현재 상태: 검토 필요");
  });

  it("LLM 빈 응답 → fitness counter 변경 0 (early empty fallback)", async () => {
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "  ",
      inputTokens: 1,
      outputTokens: 0,
      model: "claude-haiku",
    });
    await generateBriefNarrative({ status: "X" });
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(0);
    expect(s.fitness_fail).toBe(0);
  });

  it("LLM throw → fitness counter 변경 0 (catch fallback)", async () => {
    vi.mocked(callAnthropicMessage).mockRejectedValue(new Error("API down"));
    await generateBriefNarrative({ status: "Y", blocker: "z", nextAction: "n" });
    const s = getBriefCacheStats();
    expect(s.fitness_pass).toBe(0);
    expect(s.fitness_fail).toBe(0);
  });

  it("3 pass + 1 fail 후 passRate 0.75", async () => {
    // 3 pass mocks
    vi.mocked(callAnthropicMessage).mockResolvedValueOnce({ content: "X 상태", inputTokens: 1, outputTokens: 1, model: "m" });
    await generateBriefNarrative({ status: "X" });
    vi.mocked(callAnthropicMessage).mockResolvedValueOnce({ content: "Y 상태", inputTokens: 1, outputTokens: 1, model: "m" });
    await generateBriefNarrative({ status: "Y" });
    vi.mocked(callAnthropicMessage).mockResolvedValueOnce({ content: "Z 상태", inputTokens: 1, outputTokens: 1, model: "m" });
    await generateBriefNarrative({ status: "Z" });
    // 1 fail (status 누락)
    vi.mocked(callAnthropicMessage).mockResolvedValueOnce({ content: "다른 표현", inputTokens: 1, outputTokens: 1, model: "m" });
    await generateBriefNarrative({ status: "W" });

    expect(computeBriefFitnessPassRate()).toBeCloseTo(0.75, 3);
  });
});
