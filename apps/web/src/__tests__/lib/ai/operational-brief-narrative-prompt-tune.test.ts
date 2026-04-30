/**
 * §11.165 #operational-brief-llm-prompt-tune
 *
 * Source-level guard — SYSTEM_PROMPT 강화:
 *   - few-shot examples 3건 이상 (status/blocker 분기 커버)
 *   - status 원문 보존 강력 instruction
 *   - 추측/권유 금지 강력 instruction
 *   - LabAxis 운영 OS 톤 마커 (격식체 / 영어 단어 최소)
 *   - 40자 이내 길이 cap 보존
 *   - 한국어 어미 정합 ("~입니다" / 명사형)
 *
 * Behavior tests (deterministic + LLM fallback) 회귀 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../lib/ai/operational-brief-narrative.ts",
);

describe("§11.165 SYSTEM_PROMPT prompt-tune source-level guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("few-shot examples 3건 이상 (예시: 형식 검증)", () => {
    // "예시" 또는 "Example" 마커 + facts → narrative 매핑 패턴
    const shotMatches = source.match(/예시|Example|예\)|input.*output/gi);
    expect((shotMatches?.length ?? 0) >= 3).toBe(true);
  });

  it("status 원문 보존 강력 instruction (변경 0 명시)", () => {
    expect(source).toMatch(/원문\s*보존|원문\s*그대로|상태\s*값.*변경.*금지/);
  });

  it("추측/권유 금지 강력 instruction", () => {
    expect(source).toMatch(/추측.*금지|권유.*금지|facts.*벗어/);
  });

  it("LabAxis 운영 OS 톤 마커 — 영어 단어 최소 / 격식체 명시", () => {
    expect(source).toMatch(/영어\s*단어|격식체|운영자\s*어조|약어\s*금지/);
  });

  it("40자 이내 길이 cap 보존", () => {
    expect(source).toMatch(/40자|40\s*자/);
  });

  it("한국어 어미 정합 — \"~입니다\" 또는 명사형 명시", () => {
    expect(source).toMatch(/~입니다|명사형/);
  });

  it("회귀 0: callAnthropicMessage import + maxTokens 120 보존", () => {
    expect(source).toMatch(/callAnthropicMessage/);
    expect(source).toMatch(/maxTokens:\s*120/);
  });

  it("회귀 0: deterministicNarrative fallback path 보존", () => {
    expect(source).toMatch(/function deterministicNarrative/);
    expect(source).toMatch(/현재 상태:/);
  });

  it("회귀 0: isLlmEnabled env gating 보존", () => {
    expect(source).toMatch(/OPERATIONAL_BRIEF_USE_LLM/);
    expect(source).toMatch(/ANTHROPIC_API_KEY/);
  });
});
