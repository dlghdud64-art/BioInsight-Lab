/**
 * §11.201 #pricing-operating-volume-redefine — Phase 4 RED test
 *
 * /pricing public page 에 LabOps Credit 섹션 추가 강제 — 운영자가 "왜
 * 크레딧이 있는가" 를 페이지 한 곳에서 이해. 사용 작업 (AI 차감) /
 * 보호 작업 (코어 workflow 차단 0) 두 list + footnote (pilot 무제한).
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan / WorkspacePlan 변경 0 (display only)
 *   - LabOps Credit 실 차감 0 (§11.202 defer) — display only 명시
 *   - fake "AI 무제한" / "무제한 워크스페이스" 카피 sweep
 *   - 코어 workflow (검색/요청/승인/PO/입고/재고) 보호 약속 명시
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PRICING_PATH = "src/app/pricing/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.201 /pricing — LabOps Credit 섹션 노출", () => {
  it("LABOPS_CREDIT_USAGE_SCENARIOS / LABOPS_CREDIT_PROTECTED_SCENARIOS import (DRY)", () => {
    const src = read(PRICING_PATH);
    // descriptor 의 readonly array 두 개 import — 단일 source 통과
    expect(src).toMatch(/LABOPS_CREDIT_USAGE_SCENARIOS/);
    expect(src).toMatch(/LABOPS_CREDIT_PROTECTED_SCENARIOS/);
  });

  it("LabOps Credit 섹션 제목 노출 ('LabOps Credit' 또는 '운영 크레딧')", () => {
    const src = read(PRICING_PATH);
    expect(src).toMatch(/LabOps\s*Credit|운영\s*크레딧/);
  });

  it("'사용 작업' (AI 차감) / '차단 안 되는 작업' (보호) 두 list 노출", () => {
    const src = read(PRICING_PATH);
    // 두 list 의 라벨 — 사용 작업 / 차단 안 되는 작업 (또는 동의어)
    expect(src).toMatch(/사용\s*작업|차감\s*대상|AI.*작업/);
    expect(src).toMatch(/차단\s*안\s*되는|코어\s*workflow|항상\s*가용|보호되는/);
  });

  it("코어 workflow 보호 문구 — 검색/요청/승인/PO/입고/재고 모두 명시", () => {
    const src = read(PRICING_PATH);
    // LABOPS_CREDIT_PROTECTED_SCENARIOS 가 .map 으로 노출되므로 array 항목이
    // 직접 source 에 잡히지 않을 수 있음. 대신 import + render 패턴 검증.
    expect(src).toMatch(/PROTECTED_SCENARIOS/);
    // 코어 workflow 의 약속 문구 ("크레딧으로 차단되지 않습니다" 같은)
    expect(src).toMatch(/크레딧으로\s*차단|차단되지\s*않|항상\s*가용|코어\s*workflow/);
  });

  it("footnote — pilot 기간 명시 ('pilot' 또는 '파일럿' 또는 '시범 운영')", () => {
    const src = read(PRICING_PATH);
    // pilot 기간 동안 LabOps Credit 무제한 사용 명시 — display only 정직성.
    expect(src).toMatch(/pilot|파일럿|시범|베타|Beta/i);
  });
});

describe("§11.201 /pricing — fake '무제한' 약속 sweep (재차)", () => {
  it("'AI 무제한' / '무제한 워크스페이스' 카피 0 (전 page)", () => {
    const src = read(PRICING_PATH);
    expect(src).not.toMatch(/AI\s*무제한/);
    expect(src).not.toMatch(/무제한\s*워크스페이스/);
  });
});
