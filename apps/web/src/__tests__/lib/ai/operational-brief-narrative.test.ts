/**
 * §11.153 LLM-aware narrative — fallback + env gating.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateBriefNarrative } from "@/lib/ai/operational-brief-narrative";

vi.mock("@/lib/ai/anthropic", () => ({
  callAnthropicMessage: vi.fn(),
}));

import { callAnthropicMessage } from "@/lib/ai/anthropic";

describe("§11.153 generateBriefNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPERATIONAL_BRIEF_USE_LLM;
  });

  it("LLM disabled → deterministic facts 압축", async () => {
    const out = await generateBriefNarrative({
      status: "REVIEW_REQUIRED",
      blocker: "공급사 회신 미완",
      nextAction: "재요청 발송",
    });
    expect(out).toContain("현재 상태");
    expect(out).toContain("REVIEW_REQUIRED");
    expect(out).toContain("차단 — 공급사 회신 미완");
    expect(out).toContain("다음 조치 — 재요청 발송");
    expect(callAnthropicMessage).not.toHaveBeenCalled();
  });

  it("blocker '차단 없음' 은 차단 부분 생략", async () => {
    const out = await generateBriefNarrative({ status: "OK", blocker: "차단 없음", nextAction: "—" });
    expect(out).not.toContain("차단 — 차단 없음");
  });

  it("LLM enabled + ANTHROPIC_API_KEY 있을 때 호출", async () => {
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    // §11.167: narrative 에 facts.status 포함 필수 (fitness check pass)
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "X 상태 narrative.",
      inputTokens: 10,
      outputTokens: 5,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({ status: "X" });
    expect(out).toBe("X 상태 narrative.");
    expect(callAnthropicMessage).toHaveBeenCalledTimes(1);
    delete process.env.OPERATIONAL_BRIEF_USE_LLM;
  });

  it("LLM 실패 시 deterministic fallback (caller error 0)", async () => {
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.mocked(callAnthropicMessage).mockRejectedValue(new Error("API down"));
    const out = await generateBriefNarrative({ status: "Y", blocker: "z", nextAction: "n" });
    expect(out).toContain("현재 상태");
    delete process.env.OPERATIONAL_BRIEF_USE_LLM;
  });

  it("LLM 빈 응답 시 deterministic fallback", async () => {
    process.env.OPERATIONAL_BRIEF_USE_LLM = "1";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.mocked(callAnthropicMessage).mockResolvedValue({
      content: "   ",
      inputTokens: 1,
      outputTokens: 0,
      model: "claude-haiku",
    });
    const out = await generateBriefNarrative({ status: "Z" });
    expect(out).toContain("현재 상태");
    delete process.env.OPERATIONAL_BRIEF_USE_LLM;
  });
});
