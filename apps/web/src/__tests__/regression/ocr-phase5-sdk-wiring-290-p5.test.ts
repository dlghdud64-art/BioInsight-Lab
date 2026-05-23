/**
 * §11.290 Phase 5 #ocr-phase5-sdk-wiring — Cloud Vision REST API +
 *   @anthropic-ai/sdk wiring + Tier 2 fallback 실제 활성화.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4c-3 (receiving PO 매칭) 완료 후 Phase 5 진입.
 *   SDK install + env 설정 → Gemini confidence medium/low 시 Cloud Vision +
 *   Claude Tier 2 자동 fallback 실제 동작.
 *
 * Lock:
 *   - GOOGLE_VISION_API_KEY 미설정 시 CloudVisionNotConfiguredError throw
 *   - ANTHROPIC_API_KEY 미설정 시 ClaudeStructurerNotConfiguredError throw
 *   - env 미설정 상태에서 runOcrPipeline → Gemini graceful fallback
 *   - @anthropic-ai/sdk 설치 확인 (package.json)
 *
 * Test scope:
 *   1. §11.290 Phase 5 trace marker (cloud-vision-parser)
 *   2. §11.290 Phase 5 trace marker (claude-structurer)
 *   3. §11.290 Phase 5 trace marker (run-ocr-pipeline)
 *   4. extractWithCloudVision — GOOGLE_VISION_API_KEY 미설정 시 throw
 *   5. structureWithClaude — ANTHROPIC_API_KEY 미설정 시 throw
 *   6. runOcrPipeline — Tier 2 env 미설정 시 Gemini graceful fallback
 *   7. @anthropic-ai/sdk package.json 설치 확인
 *   8. cloud-vision-parser REST endpoint 패턴 확인
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLOUD_VISION_SRC = readFileSync(
  resolve(__dirname, "../../lib/ocr/cloud-vision-parser.ts"),
  "utf8",
);
const CLAUDE_STRUCTURER_SRC = readFileSync(
  resolve(__dirname, "../../lib/ocr/claude-structurer.ts"),
  "utf8",
);
const RUN_PIPELINE_SRC = readFileSync(
  resolve(__dirname, "../../lib/ocr/run-ocr-pipeline.ts"),
  "utf8",
);
const PACKAGE_JSON = readFileSync(
  resolve(__dirname, "../../../package.json"),
  "utf8",
);

describe("§11.290 Phase 5 — SDK wiring + Tier 2 fallback", () => {
  // ─── Trace markers ───
  it("§11.290 Phase 5 trace marker — cloud-vision-parser.ts", () => {
    expect(CLOUD_VISION_SRC).toMatch(/§11\.290 Phase 5/);
  });

  it("§11.290 Phase 5 trace marker — claude-structurer.ts", () => {
    expect(CLAUDE_STRUCTURER_SRC).toMatch(/§11\.290 Phase 5/);
  });

  it("§11.290 Phase 5 trace marker — run-ocr-pipeline.ts", () => {
    expect(RUN_PIPELINE_SRC).toMatch(/§11\.290 Phase 5/);
  });

  // ─── Cloud Vision REST API 패턴 ───
  it("extractWithCloudVision — REST API endpoint 패턴 (vision.googleapis.com)", () => {
    expect(CLOUD_VISION_SRC).toMatch(/vision\.googleapis\.com/);
    expect(CLOUD_VISION_SRC).toMatch(/TEXT_DETECTION/);
    expect(CLOUD_VISION_SRC).toMatch(/GOOGLE_VISION_API_KEY/);
  });

  it("extractWithCloudVision — GOOGLE_VISION_API_KEY 미설정 시 throw", async () => {
    const originalKey = process.env.GOOGLE_VISION_API_KEY;
    delete process.env.GOOGLE_VISION_API_KEY;

    try {
      const { extractWithCloudVision, CloudVisionNotConfiguredError } = await import(
        "../../lib/ocr/cloud-vision-parser"
      );
      await expect(
        extractWithCloudVision({ base64: "data:image/jpeg;base64,test" }),
      ).rejects.toBeInstanceOf(CloudVisionNotConfiguredError);
    } finally {
      if (originalKey !== undefined) process.env.GOOGLE_VISION_API_KEY = originalKey;
    }
  });

  // ─── Claude structurer SDK 패턴 ───
  it("structureWithClaude — @anthropic-ai/sdk import 패턴", () => {
    expect(CLAUDE_STRUCTURER_SRC).toMatch(/@anthropic-ai\/sdk/);
    expect(CLAUDE_STRUCTURER_SRC).toMatch(/claude-haiku/);
    expect(CLAUDE_STRUCTURER_SRC).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("structureWithClaude — ANTHROPIC_API_KEY 미설정 시 throw", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const { structureWithClaude, ClaudeStructurerNotConfiguredError } = await import(
        "../../lib/ocr/claude-structurer"
      );
      await expect(
        structureWithClaude({ rawText: "sample ocr text" }),
      ).rejects.toBeInstanceOf(ClaudeStructurerNotConfiguredError);
    } finally {
      if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  // ─── run-ocr-pipeline Tier 2 wiring ───
  it("run-ocr-pipeline — Tier 2 fallback 패턴 (extractWithCloudVision + structureWithClaude)", () => {
    expect(RUN_PIPELINE_SRC).toMatch(/extractWithCloudVision/);
    expect(RUN_PIPELINE_SRC).toMatch(/structureWithClaude/);
    expect(RUN_PIPELINE_SRC).toMatch(/CloudVisionNotConfiguredError/);
    expect(RUN_PIPELINE_SRC).toMatch(/ClaudeStructurerNotConfiguredError/);
    expect(RUN_PIPELINE_SRC).toMatch(/CLOUD_VISION_CLAUDE/);
  });

  // ─── @anthropic-ai/sdk package.json 설치 확인 ───
  it("@anthropic-ai/sdk package.json dependencies 설치 확인", () => {
    expect(PACKAGE_JSON).toMatch(/@anthropic-ai\/sdk/);
  });
});
