/**
 * #approver-routing-multi-tier-threshold Phase 1 — RED test
 *
 * approval-threshold-section component 가 2 input (저액/고액 임계치):
 *   - approvalLowThresholdKrw — 중액/저액 구분 (default 1M)
 *   - approvalThresholdKrw — 고액/중액 구분 (default 10M, 직전 batch field)
 *
 * 한국어 label 명시 + 한국어 description (3 tier 의미).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const COMPONENT = "src/components/settings/approval-threshold-section.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-multi-tier-threshold — approval-threshold-section component 2 input", () => {
  it("approvalLowThresholdKrw state 또는 input 정의", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/approvalLowThresholdKrw/);
  });

  it("approvalThresholdKrw state 보존 (직전 batch)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/approvalThresholdKrw/);
  });

  it("저액/중액 구분 한국어 label", () => {
    const src = read(COMPONENT);
    // "저액" 또는 "중액" 또는 "저액 임계치" 명시
    expect(src).toMatch(/저액|중액 시작/);
  });

  it("고액 구분 한국어 label", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/고액/);
  });

  it("PATCH body 에 두 threshold 모두 전달", () => {
    const src = read(COMPONENT);
    // mutation body 에 approvalLowThresholdKrw + approvalThresholdKrw 동시
    expect(src).toMatch(/approvalLowThresholdKrw[\s\S]*?approvalThresholdKrw|approvalThresholdKrw[\s\S]*?approvalLowThresholdKrw/);
  });

  it("low <= high validation (form-level, 사용자 입력 오류 차단)", () => {
    const src = read(COMPONENT);
    // low > high 시 validation message 또는 disable 또는 toast error
    expect(src).toMatch(/저액[^>]*고액|low[^>]*high|이상/);
  });
});
