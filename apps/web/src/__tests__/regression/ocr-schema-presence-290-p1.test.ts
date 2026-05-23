/**
 * §11.290 Phase 1 #ocr-schema-presence — OcrJob + OcrResult Prisma model
 *   존재 + 핵심 field 정합 sentinel test.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Multi-provider OCR fallback (Gemini primary + Cloud Vision + Claude
 *   secondary + regex tertiary) 의 audit / cache / 재처리 root 가 될
 *   OcrJob / OcrResult Prisma model + 3 enum (OcrJobType / OcrJobStatus
 *   / OcrProvider).
 *
 * 작업 위치:
 *   apps/web/prisma/schema.prisma 끝에 append (DashboardStatsSnapshot 다음).
 *
 * Phase 0 audit 확인 (2026-05-23):
 *   grep "OcrJob\|OcrResult\|OcrProvider" schema.prisma → 0 hit (RED).
 *
 * Fix scope (Phase 1):
 *   - model OcrJob (id / organizationId / userId / type / imageUrl / imageHash
 *     / status / finalResultId / createdAt / updatedAt + 2 index)
 *   - model OcrResult (id / jobId / provider / parsedFields / confidence
 *     / rawText / costUsd / latencyMs / errorMessage / createdAt + 1 index)
 *   - enum OcrJobType (LABEL / QUOTE)
 *   - enum OcrJobStatus (PENDING / RUNNING / SUCCESS / FAILED / NEEDS_REVIEW)
 *   - enum OcrProvider (GEMINI / CLOUD_VISION_CLAUDE)
 *
 * 의도적 lock:
 *   - Multi-provider 결과 cross-validation 위한 OcrResult 1:N (OcrJob:OcrResult)
 *   - Image hash @@index 로 cache lookup O(log n)
 *   - costUsd / latencyMs 로 Phase 5 cost monitoring 가능
 *   - errorMessage 로 fallback chain audit
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = readFileSync(
  resolve(__dirname, "../../../prisma/schema.prisma"),
  "utf8",
);

describe("§11.290 Phase 1 — OcrJob + OcrResult schema presence", () => {
  it("§11.290 trace marker 존재 (schema 주석에 cluster 표기)", () => {
    expect(SCHEMA).toMatch(/§11\.290/);
  });

  // ─── enum OcrJobType ───
  it("enum OcrJobType — LABEL + QUOTE 2 value 존재", () => {
    expect(SCHEMA).toMatch(/enum OcrJobType\s*\{[\s\S]*?LABEL[\s\S]*?QUOTE[\s\S]*?\}/);
  });

  // ─── enum OcrJobStatus ───
  it("enum OcrJobStatus — PENDING / RUNNING / SUCCESS / FAILED / NEEDS_REVIEW 5 value", () => {
    expect(SCHEMA).toMatch(
      /enum OcrJobStatus\s*\{[\s\S]*?PENDING[\s\S]*?RUNNING[\s\S]*?SUCCESS[\s\S]*?FAILED[\s\S]*?NEEDS_REVIEW[\s\S]*?\}/,
    );
  });

  // ─── enum OcrProvider ───
  it("enum OcrProvider — GEMINI / CLOUD_VISION_CLAUDE / REGEX 3 value (3-tier fallback)", () => {
    expect(SCHEMA).toMatch(
      /enum OcrProvider\s*\{[\s\S]*?GEMINI[\s\S]*?CLOUD_VISION_CLAUDE[\s\S]*?REGEX[\s\S]*?\}/,
    );
  });

  // ─── model OcrJob ───
  it("model OcrJob — 핵심 field 9개 + 2 index 존재", () => {
    const ocrJobMatch = SCHEMA.match(/model OcrJob\s*\{[\s\S]*?\n\}/);
    expect(ocrJobMatch).not.toBeNull();
    const block = ocrJobMatch![0];

    // 핵심 field 9개 (organizationId 사용 — 기존 schema 정합)
    expect(block).toMatch(/\bid\s+String\s+@id/);
    expect(block).toMatch(/\borganizationId\s+String/);
    expect(block).toMatch(/\buserId\s+String/);
    expect(block).toMatch(/\btype\s+OcrJobType/);
    expect(block).toMatch(/\bimageUrl\s+String/);
    expect(block).toMatch(/\bimageHash\s+String/);
    expect(block).toMatch(/\bstatus\s+OcrJobStatus/);
    expect(block).toMatch(/\bcreatedAt\s+DateTime/);
    expect(block).toMatch(/\bupdatedAt\s+DateTime/);

    // 2 index (organizationId+type / imageHash)
    expect(block).toMatch(/@@index\(\[organizationId,\s*type\]\)/);
    expect(block).toMatch(/@@index\(\[imageHash\]\)/);
  });

  // ─── model OcrResult ───
  it("model OcrResult — 핵심 field 9개 + 1 index 존재", () => {
    const ocrResultMatch = SCHEMA.match(/model OcrResult\s*\{[\s\S]*?\n\}/);
    expect(ocrResultMatch).not.toBeNull();
    const block = ocrResultMatch![0];

    // 핵심 field 9개 (cost 는 Float — 기존 schema 에서 Decimal 미사용 정합)
    expect(block).toMatch(/\bid\s+String\s+@id/);
    expect(block).toMatch(/\bjobId\s+String/);
    expect(block).toMatch(/\bprovider\s+OcrProvider/);
    expect(block).toMatch(/\bparsedFields\s+Json/);
    expect(block).toMatch(/\bconfidence\s+Float/);
    expect(block).toMatch(/\bcostUsd\s+Float/);
    expect(block).toMatch(/\blatencyMs\s+Int/);
    // rawText + errorMessage 는 nullable
    expect(block).toMatch(/\brawText\s+String\?/);
    expect(block).toMatch(/\berrorMessage\s+String\?/);
    expect(block).toMatch(/\bcreatedAt\s+DateTime/);

    // 1 index (jobId)
    expect(block).toMatch(/@@index\(\[jobId\]\)/);
  });

  // ─── OcrJob ↔ OcrResult relation ───
  it("OcrJob ↔ OcrResult — 1:N relation + finalResultId 1:1 (canonical winner)", () => {
    const ocrJobMatch = SCHEMA.match(/model OcrJob\s*\{[\s\S]*?\n\}/);
    const ocrResultMatch = SCHEMA.match(/model OcrResult\s*\{[\s\S]*?\n\}/);
    expect(ocrJobMatch).not.toBeNull();
    expect(ocrResultMatch).not.toBeNull();

    // OcrJob 측: results OcrResult[] (1:N) + finalResult OcrResult? (1:1)
    expect(ocrJobMatch![0]).toMatch(/\bresults\s+OcrResult\[\]/);
    expect(ocrJobMatch![0]).toMatch(/\bfinalResult\s+OcrResult\?/);

    // OcrResult 측: job OcrJob (reverse relation)
    expect(ocrResultMatch![0]).toMatch(/\bjob\s+OcrJob\s+@relation/);
    expect(ocrResultMatch![0]).toMatch(/onDelete:\s*Cascade/);
  });
});
