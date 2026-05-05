/**
 * #approver-routing-cross-field-validation-runtime-current-vs-pending — RED→GREEN test
 *
 * /api/workspaces/[id] PATCH 의 partial update cross-field validation.
 * 직전 zod refine 의 한계 보완 — partial update (low 또는 high 단독 변경)
 * 시 DB 의 기존 값과 합성한 후 low ≤ high 검증.
 *
 * Scope:
 *   - PATCH route 안에 합성 검증 logic 추가 (beforeThresholds 재사용)
 *   - finalLow > finalHigh → 400 + 한국어 message
 *   - source-level grep (beforeThresholds 와 updateData 합성 분기)
 *
 * Out of scope:
 *   - zod schema 변경 (직전 batch 의 refine 보존 — 둘 다 명시 시 fast-path)
 *   - DB 자체 constraint (CHECK constraint 별도 batch)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-cross-field-validation-runtime-current-vs-pending", () => {
  it("PATCH route 안에 finalLow / finalHigh 합성 (updateData ?? beforeValue)", () => {
    const src = read(ROUTE);
    // updateData 의 값 또는 beforeThresholds 의 값 — partial update 호환
    expect(src).toMatch(/(?:finalLow|effectiveLow|mergedLow|composedLow)|approvalLowThresholdKrw\s*\?\?[\s\S]*beforeThresholds/);
    expect(src).toMatch(/(?:finalHigh|effectiveHigh|mergedHigh|composedHigh)|approvalThresholdKrw\s*\?\?[\s\S]*beforeThresholds/);
  });

  it("finalLow > finalHigh → 400 + 한국어 message", () => {
    const src = read(ROUTE);
    // 합성 비교 후 NextResponse.json({error or message}, {status: 400}) 패턴
    expect(src).toMatch(/저액[^"']*고액[^"']*이하|저액[^"']*≤[^"']*고액|저액 임계치는 고액 임계치 이하/);
    expect(src).toMatch(/status:\s*400/);
  });

  it("validation 시점이 workspace.update 전 (mutation 차단)", () => {
    const src = read(ROUTE);
    // beforeThresholds capture 후, update 호출 전에 검증 위치
    // grep — 합성 logic 의 일부 키워드 (finalLow / finalHigh / 합성) 가 db.workspace.update 보다 앞
    const updateIdx = src.indexOf("db.workspace.update");
    const validationIdx = src.search(/finalLow|finalHigh|effectiveLow|effectiveHigh|mergedLow|mergedHigh/);
    expect(validationIdx).toBeGreaterThan(0);
    expect(validationIdx).toBeLessThan(updateIdx);
  });

  it("partial update (low 만 명시 / high 미명시) 시 beforeThresholds.high 재사용", () => {
    const src = read(ROUTE);
    // beforeThresholds.approvalThresholdKrw 또는 비슷한 패턴이 합성에 사용
    expect(src).toMatch(/beforeThresholds[?.]\s*\.?approvalThresholdKrw/);
    expect(src).toMatch(/beforeThresholds[?.]\s*\.?approvalLowThresholdKrw/);
  });

  it("§11.209d-approver-routing 또는 cross-field-validation-runtime 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/cross-field-validation-runtime|partial update|partial\s*update|§11\.209d-approver-routing/);
  });
});
