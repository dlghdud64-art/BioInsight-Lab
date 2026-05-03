/**
 * §11.201e #pricing-refinement-final — RED test
 *
 * 호영님 cluster post-close refinement 7 항목 강제:
 *   1. Hero copy "연구 구매 운영량에 맞는" + 부제 (운영 체인)
 *   2. 카드 높이 통일 (items-stretch + h-full flex flex-col + mt-auto CTA)
 *   3. "권장" / "고정" → "포함"
 *   4. Starter 무료 파일럿 positioning
 *   5. CTA "결제 진행" 폐기 → "시작하기" / "상담" (real checkout 부재)
 *   6. LabOps Credit "AI 작업" → "자동화 작업" + 영어 혼용 정리
 *   7. 비교표 플랜명 통일 (Team/Business → Lab Team/R&D Operations)
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan / Stripe price ID 변경 0
 *   - dead checkout 0 — fake "결제 진행" 카피 sweep (real backend 없음)
 *   - same-canvas same-component 정합 (PLAN_DESCRIPTOR single source)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PRICING = "src/app/pricing/page.tsx";
const DESCRIPTOR = "src/lib/billing/plan-descriptor.ts";
const DASHBOARD_PRICING = "src/app/dashboard/pricing/page.tsx";
const BILLING_API = "src/app/api/billing/route.ts";
const SETTINGS_PLANS = "src/app/dashboard/settings/plans/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.201e Hero copy — 운영량 기준", () => {
  it("hero h1 — '연구 구매 운영량에 맞는 플랜을 선택하세요'", () => {
    const src = read(PRICING);
    expect(src).toMatch(/연구\s*구매\s*운영량에\s*맞는\s*플랜을?\s*선택하세요/);
    // 이전 톤 폐기
    expect(src).not.toMatch(/연구실\s*규모에\s*맞는\s*플랜을?\s*선택/);
  });

  it("부제 — 운영 체인 (RFQ / 승인 / PO 전환 / 입고 / 재고 / 재주문) 명시", () => {
    const src = read(PRICING);
    // 운영 체인 키워드 — 운영자 친화 sequence
    expect(src).toMatch(/RFQ.*승인.*PO|PO.*입고.*재고|재주문/);
    expect(src).toMatch(/연구\s*구매\s*운영\s*체인|운영\s*체인에/);
  });
});

describe("§11.201e PLAN_DESCRIPTOR — '권장' → '포함' swap", () => {
  it("descriptor.team.features — '운영자 5명 포함' (권장 폐기)", () => {
    const src = read(DESCRIPTOR);
    expect(src).toMatch(/운영자\s*5명\s*포함/);
    expect(src).not.toMatch(/운영자\s*5명\s*권장/);
  });

  it("descriptor.business.features — '운영자 15명 포함'", () => {
    const src = read(DESCRIPTOR);
    expect(src).toMatch(/운영자\s*15명\s*포함/);
    expect(src).not.toMatch(/운영자\s*15명\s*권장/);
  });

  it("descriptor.team.ctaLabel — '시작하기' / '상담' (결제 진행 0)", () => {
    const src = read(DESCRIPTOR);
    expect(src).toMatch(/Lab\s*Team\s*시작하기/);
    expect(src).not.toMatch(/Lab\s*Team\s*결제\s*진행/);
  });

  it("descriptor.business.ctaLabel — 'R&D 운영 플랜 상담'", () => {
    const src = read(DESCRIPTOR);
    expect(src).toMatch(/R&D\s*운영\s*플랜\s*상담/);
    expect(src).not.toMatch(/R&D\s*Operations\s*결제\s*진행/);
  });

  it("descriptor.starter — 무료 파일럿 positioning (tagline 또는 ctaLabel)", () => {
    const src = read(DESCRIPTOR);
    expect(src).toMatch(/무료\s*파일럿|14일\s*전체\s*운영/);
  });
});

describe("§11.201e 카드 높이 통일 — Tailwind contract", () => {
  it("/pricing grid wrapper — items-stretch 필수", () => {
    const src = read(PRICING);
    expect(src).toMatch(/items-stretch/);
  });

  it("PlanCard — h-full + flex + flex-col + CTA mt-auto 패턴", () => {
    const src = read(PRICING);
    // 카드 root 가 h-full flex flex-col (또는 동등)
    expect(src).toMatch(/h-full[\s\S]*?flex[\s\S]*?flex-col|flex[\s\S]*?flex-col[\s\S]*?h-full/);
    // CTA 영역이 mt-auto 로 카드 하단 고정
    expect(src).toMatch(/mt-auto/);
  });
});

describe("§11.201e LabOps Credit 섹션 — 한국어 정합", () => {
  it("섹션 제목 — '자동화 작업은 LabOps Credit 으로' (AI 작업 폐기)", () => {
    const src = read(PRICING);
    expect(src).toMatch(/자동화\s*작업은?\s*LabOps\s*Credit/);
    expect(src).not.toMatch(/AI\s*작업은?\s*LabOps\s*Credit/);
  });

  it("코어 workflow 영어 혼용 폐기 — '핵심 운영 흐름' 한국어", () => {
    const src = read(PRICING);
    expect(src).toMatch(/핵심\s*운영\s*흐름|핵심\s*운영을/);
    expect(src).not.toMatch(/코어\s*운영\s*workflow|코어\s*workflow/);
  });

  it("'크레딧 잔량과 관계없이' — Credit 소진 영어 혼용 폐기", () => {
    const src = read(PRICING);
    expect(src).toMatch(/크레딧\s*잔량과?\s*관계없이|잔량.*관계없이/);
    expect(src).not.toMatch(/Credit\s*소진/);
  });

  it("label — '크레딧으로 차감되는 자동화' / '크레딧으로 차감되지 않는 핵심 운영'", () => {
    const src = read(PRICING);
    expect(src).toMatch(/크레딧으로\s*차감되는\s*자동화/);
    expect(src).toMatch(/크레딧으로\s*차감되지\s*않는\s*핵심\s*운영/);
  });
});

describe("§11.201e 비교표 플랜명 통일", () => {
  it("/pricing 비교표 TH — 'Lab Team' / 'R&D Operations' 노출 (Team / Business 단독 폐기)", () => {
    const src = read(PRICING);
    // 비교표 헤더에 Lab Team + R&D Operations 명시
    expect(src).toMatch(/Lab\s*Team/);
    expect(src).toMatch(/R&D\s*Operations/);
    // raw 'Team' 만 단독으로 카드/테이블 헤더에 있으면 안 됨 (카드 카피는 이미 swap 됨)
    expect(src).not.toMatch(/>\s*Team\s*<\/th>/);
    expect(src).not.toMatch(/>\s*Business\s*<\/th>/);
  });
});

describe("§11.201e sweep 정합 — api/billing + settings/plans 동기화", () => {
  it("api/billing PLAN_INFO TEAM/ORGANIZATION features — '포함' 정합", () => {
    const src = read(BILLING_API);
    expect(src).toMatch(/운영자\s*5명\s*포함/);
    expect(src).toMatch(/운영자\s*15명\s*포함/);
    expect(src).not.toMatch(/운영자\s*\d+명\s*권장/);
  });

  it("settings/plans PLAN_CARDS features — '포함' 정합", () => {
    const src = read(SETTINGS_PLANS);
    expect(src).toMatch(/운영자\s*5명\s*포함/);
    expect(src).toMatch(/운영자\s*15명\s*포함/);
    expect(src).not.toMatch(/운영자\s*\d+명\s*권장/);
  });

  it("dashboard/pricing — descriptor 통과 (별도 hardcoded copy 없음)", () => {
    const src = read(DASHBOARD_PRICING);
    // descriptor.ctaLabel 사용 (직접 hardcoded "Lab Team 결제 진행" 없음)
    expect(src).toMatch(/ctaLabel/);
    expect(src).not.toMatch(/"Lab\s*Team\s*결제\s*진행"/);
  });
});
