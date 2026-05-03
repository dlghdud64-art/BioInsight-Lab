/**
 * §11.201d #pricing-fake-unlimited-sweep — RED test
 *
 * settings/plans/page.tsx + api/billing/route.ts 의 hardcoded "팀원 무제한"·
 * "품목 등록 무제한" fake 약속 카피 0 강제. PLAN_DESCRIPTOR 정량 매트릭스
 * (운영자 N명 / RFQ N건 / 재고 N 품목) 정합.
 *
 * §11.201 cluster 의 후속 sweep (PLAN.md Phase 4 RED 명시 외, defer 후 진입).
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan / WorkspacePlan 변경 0 (display only)
 *   - dynamic maxSeats === null → "무제한" (Enterprise contract-based) 은 보존
 *   - hardcoded "팀원 무제한"·"품목 등록 무제한" features array 만 sweep
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SETTINGS_PLANS = "src/app/dashboard/settings/plans/page.tsx";
const BILLING_API = "src/app/api/billing/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.201d /api/billing — features array 정량 swap", () => {
  it("hardcoded '팀원 무제한' features 카피 0 occurrence", () => {
    const src = read(BILLING_API);
    expect(src).not.toMatch(/"팀원\s*무제한"/);
    expect(src).not.toMatch(/"품목\s*등록\s*무제한"/);
  });

  it("정량 운영자 권장치 노출 ('운영자 N명 권장' 또는 '5명까지' 같은 정량)", () => {
    const src = read(BILLING_API);
    // PLAN_DESCRIPTOR.team.seatsRecommended = 5 / business.seatsRecommended = 15
    expect(src).toMatch(/운영자\s*\d+\s*명|좌석\s*\d+|\d+명까지/);
  });

  it("정량 운영량 (RFQ / 재고) 노출", () => {
    const src = read(BILLING_API);
    // descriptor 의 monthlyRfq / inventoryItems 정합 매트릭스
    expect(src).toMatch(/RFQ\s*\d+|견적\s*요청.*\d+|재고\s*\d/);
  });

  it("nameKo — 한국어 라벨 정합 ('Lab Team' / 'R&D Operations')", () => {
    const src = read(BILLING_API);
    expect(src).toMatch(/Lab\s*Team/);
    expect(src).toMatch(/R&D\s*Operations/);
    // 영문 'Business' 단독 nameKo 폐기
    expect(src).not.toMatch(/nameKo:\s*"Business"/);
  });
});

describe("§11.201d settings/plans — features array 정량 swap", () => {
  it("hardcoded '팀원 무제한' / '품목 등록 무제한' features 카피 0 (PLANS array 안)", () => {
    const src = read(SETTINGS_PLANS);
    // features array 안의 hardcoded 카피만 sweep — dynamic maxSeats === null
    // ? "무제한" 분기 (Enterprise contract) 는 보존.
    expect(src).not.toMatch(/"팀원\s*무제한"/);
    expect(src).not.toMatch(/"품목\s*등록\s*무제한"/);
  });

  it("정량 운영자 / RFQ / 재고 권장치 노출", () => {
    const src = read(SETTINGS_PLANS);
    expect(src).toMatch(/운영자\s*\d+\s*명|좌석\s*\d+|\d+명까지/);
    expect(src).toMatch(/RFQ\s*\d+|견적\s*요청.*\d+/);
    expect(src).toMatch(/재고.*\d|품목.*\d/);
  });

  it("dynamic 'maxSeats === null ? 무제한' (Enterprise contract) 분기는 보존", () => {
    const src = read(SETTINGS_PLANS);
    // canonical contract-based "무제한" 분기는 운영자 가용성 표현 — 유지.
    expect(src).toMatch(/maxSeats\s*===\s*null\s*\?\s*"무제한"/);
  });
});
