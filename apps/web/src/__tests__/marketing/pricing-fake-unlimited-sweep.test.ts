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

  it("정량 운영자 권장치 노출 (정량 단어 OR PLAN_DESCRIPTOR import — #pricing-descriptor-direct-import 정합)", () => {
    const src = read(BILLING_API);
    // PLAN_DESCRIPTOR.team.seatsRecommended = 5 / business.seatsRecommended = 15
    // direct import 후 source 에는 정량 단어 보이지 않을 수 있음 — descriptor
    // import 자체가 정량 약속의 lock 이므로 OR 매칭.
    expect(src).toMatch(/운영자\s*\d+\s*명|좌석\s*\d+|\d+명까지|PLAN_DESCRIPTOR\.\w+\.features/);
  });

  it("정량 운영량 (RFQ / 재고) 노출", () => {
    const src = read(BILLING_API);
    // descriptor 의 monthlyRfq / inventoryItems 정합 매트릭스 OR descriptor import
    expect(src).toMatch(/RFQ\s*\d+|견적\s*요청.*\d+|재고\s*\d|PLAN_DESCRIPTOR\.\w+\.features/);
  });

  it("nameKo — 한국어 라벨 정합 (#pricing-descriptor-direct-import 정합)", () => {
    const src = read(BILLING_API);
    // direct import 후 nameKo: PLAN_DESCRIPTOR.X.label 사용 → "Lab Team"
    // 같은 단어가 source 에 직접 없을 수 있음. descriptor.label import OR
    // 단어 직접 매칭 둘 다 정합.
    expect(src).toMatch(/Lab\s*Team|PLAN_DESCRIPTOR\.team\.label/);
    expect(src).toMatch(/R&D\s*Operations|PLAN_DESCRIPTOR\.business\.label/);
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

  it("정량 운영자 / RFQ / 재고 권장치 노출 (#pricing-descriptor-direct-import 정합)", () => {
    const src = read(SETTINGS_PLANS);
    // direct import 후 정량 단어 OR descriptor import 매칭. descriptor 가
    // 정량 약속의 single source.
    expect(src).toMatch(/운영자\s*\d+\s*명|좌석\s*\d+|\d+명까지|PLAN_DESCRIPTOR\.\w+\.features/);
    expect(src).toMatch(/RFQ\s*\d+|견적\s*요청.*\d+|PLAN_DESCRIPTOR\.\w+\.features/);
    expect(src).toMatch(/재고.*\d|품목.*\d|PLAN_DESCRIPTOR\.\w+\.features/);
  });

  it("dynamic 'maxSeats === null ? 무제한' (Enterprise contract) 분기는 보존", () => {
    const src = read(SETTINGS_PLANS);
    // canonical contract-based "무제한" 분기는 운영자 가용성 표현 — 유지.
    expect(src).toMatch(/maxSeats\s*===\s*null\s*\?\s*"무제한"/);
  });
});
