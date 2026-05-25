/**
 * §11.304 #plan-tier-naming — 플랜 티어명 등급화 (Free / Basic / Pro /
 *   Enterprise) + /pricing 히어로 제거 + 인원 구간 정합 (5→3, 15→10) +
 *   추가 인당 단가 표기.
 *
 * 호영님 P1 (전환 직결, 결제 직전 이탈 요인):
 *   기존 티어명 (Lab Team / R&D Operations) 은 "누가 쓰는가" 를 규정 →
 *   "우리는 팀이 아닌데?" / "우리는 R&D가 아닌데?" 정체성 의문 → 전환 저해.
 *   글로벌 표준 위계 (Free < Basic < Pro < Enterprise) 으로 swap, 부제
 *   권장형 ("N명 규모에 적합") 으로 사용자 유형 규정 제거.
 *
 * Scope:
 *   - plan-descriptor.ts 4 label / 4 tagline / 4 ctaLabel / 2 recommendTag
 *     / Basic seatsRecommended 5→3 / Pro seatsRecommended 15→10 /
 *     features 운영자 표기 (추가 1명당 ₩35,000 / ₩28,000)
 *   - pricing/page.tsx 히어로 섹션 제거 + 월간/연간 토글 plan cards 위
 *     별도 section + 비교 표 헤더 4 티어 정합 + featured regex 정합
 *   - lib/plans.ts PLAN_DISPLAY 정합 + getPlanDisplayName fallback "Free"
 *   - 4 caller file (billing / dashboard / settings/plans / organizations)
 *     PLAN_LABELS / PLAN_INTENT_LABELS / PLAN_MAP 매핑 정합
 *   - organizations/[id]/page.tsx:469 "Starter" → "Free" 정합
 *
 * Backend out of scope (§11.303b 또는 별도):
 *   - includedSeats field 5→3 / 15→10
 *   - additionalSeatPrice field 신규 (35000 / 28000)
 *   - per-seat billing logic
 *   - 기존 가입자 grandfather 정책
 *   - maxQuotesPerMonth = null
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const DESCRIPTOR_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/billing/plan-descriptor.ts"),
  "utf8",
);
const PLANS_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/plans.ts"),
  "utf8",
);
const PRICING_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/pricing/page.tsx"),
  "utf8",
);
const BILLING_PAGE_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/billing/page.tsx"),
  "utf8",
);
const DASHBOARD_PAGE_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/dashboard/page.tsx"),
  "utf8",
);
const SETTINGS_PLANS_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/dashboard/settings/plans/page.tsx"),
  "utf8",
);
const ORGS_PAGE_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/dashboard/organizations/page.tsx"),
  "utf8",
);
const ORG_DETAIL_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§11.304 — 플랜 티어명 등급화 (Free / Basic / Pro / Enterprise)", () => {
  it("§11.304 trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.304/);
  });

  describe("plan-descriptor.ts 4 label 등급화", () => {
    it("starter.label = \"Free\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/intent:\s*"starter"[\s\S]*?label:\s*"Free"/);
    });

    it("team.label = \"Basic\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/intent:\s*"team"[\s\S]*?label:\s*"Basic"/);
    });

    it("business.label = \"Pro\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/intent:\s*"business"[\s\S]*?label:\s*"Pro"/);
    });

    it("enterprise.label = \"Enterprise\" 유지", () => {
      expect(DESCRIPTOR_SRC).toMatch(/intent:\s*"enterprise"[\s\S]*?label:\s*"Enterprise"/);
    });

    it("기존 라벨 (Starter / Lab Team / R&D Operations) literal 0 (descriptor 내부)", () => {
      // descriptor PLAN_DESCRIPTOR 본체에서 기존 label 사용 0.
      // comment 안에는 history reference 보존 가능 (§11.209c 등).
      // 정확히 label: "..." 패턴만 검사.
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"Starter"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"Lab Team"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"R&D Operations"/);
    });
  });

  describe("plan-descriptor.ts 4 tagline 권장형 (조직 유형 규정 제거)", () => {
    it("starter.tagline = \"도입 검토 · 1인 사용에 적합\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/tagline:\s*"도입 검토 · 1인 사용에 적합"/);
    });

    it("team.tagline = \"소규모 운영 · 3명 규모에 적합\" (5→3 인원 정합)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/tagline:\s*"소규모 운영 · 3명 규모에 적합"/);
    });

    it("business.tagline = \"다중 운영 · 통제 기능 · 10명 규모에 적합\" (15→10 인원 정합)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /tagline:\s*"다중 운영 · 통제 기능 · 10명 규모에 적합"/,
      );
    });

    it("enterprise.tagline = \"기관 · 계약형 운영 · 좌석/운영량 협의\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/tagline:\s*"기관 · 계약형 운영 · 좌석\/운영량 협의"/);
    });
  });

  describe("plan-descriptor.ts seatsRecommended 인원 구간 (5→3, 15→10)", () => {
    it("team.seatsRecommended = 3 (Basic, 1→5 점프 완화)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"team"[\s\S]*?seatsRecommended:\s*3/,
      );
    });

    it("business.seatsRecommended = 10 (Pro, Quartzy Pro 동등 인당 단가)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"business"[\s\S]*?seatsRecommended:\s*10/,
      );
    });
  });

  describe("plan-descriptor.ts features 운영자 표기 + 추가 인당 단가", () => {
    it("team features 운영자 3명 포함 (추가 1명당 ₩35,000/월)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /"운영자 3명 포함 \(추가 1명당 ₩35,000\/월\)"/,
      );
    });

    it("business features 운영자 10명 포함 (추가 1명당 ₩28,000/월)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /"운영자 10명 포함 \(추가 1명당 ₩28,000\/월\)"/,
      );
    });

    it("team features 선두 \"Free 전체 +\" (Starter→Free 정합)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"Free 전체 \+"/);
    });

    it("business features 선두 \"Basic 전체 +\" (Lab Team→Basic 정합)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"Basic 전체 \+"/);
    });

    it("enterprise features 선두 \"Pro 전체 +\" (R&D Operations→Pro 정합)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"Pro 전체 \+"/);
    });
  });

  describe("plan-descriptor.ts 4 ctaLabel 새 티어명 정합", () => {
    it("starter.ctaLabel = \"무료로 시작\" (파일럿 단어 제거)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"무료로 시작"/);
    });

    it("team.ctaLabel = \"Basic 시작하기\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"Basic 시작하기"/);
    });

    it("business.ctaLabel = \"Pro 시작하기\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"Pro 시작하기"/);
    });

    it("enterprise.ctaLabel = \"영업 문의하기\" 유지", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"영업 문의하기"/);
    });
  });

  describe("plan-descriptor.ts 2 recommendTag 등급화 (조직 유형 규정 제거)", () => {
    it("team.recommendTag = \"가장 많이 선택\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/recommendTag:\s*"가장 많이 선택"/);
    });

    it("business.recommendTag = \"성장 단계 추천\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/recommendTag:\s*"성장 단계 추천"/);
    });

    it("기존 추천 배지 (\"추천: 단일 연구실 운영\" / \"추천: R&D 센터 운영\") 제거", () => {
      expect(DESCRIPTOR_SRC).not.toMatch(/recommendTag:\s*"추천: 단일 연구실 운영"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/recommendTag:\s*"추천: R&D 센터 운영"/);
    });
  });

  describe("pricing/page.tsx 히어로 섹션 제거", () => {
    it("히어로 H1 \"연구소 조달 운영 OS\" 제거", () => {
      expect(PRICING_SRC).not.toMatch(/연구소 조달 운영 OS/);
    });

    it("히어로 부제 \"검색부터 승인까지\" 제거", () => {
      expect(PRICING_SRC).not.toMatch(/검색부터 승인까지/);
    });

    it("4단계 탭 (data-testid=\"pricing-operations-flow\") 제거", () => {
      expect(PRICING_SRC).not.toMatch(/pricing-operations-flow/);
    });

    it("상단 CTA \"데모 보기\" 제거", () => {
      expect(PRICING_SRC).not.toMatch(/데모 보기/);
    });

    it("decision-status 칩 (pricing-decision-status) 제거", () => {
      expect(PRICING_SRC).not.toMatch(/pricing-decision-status/);
    });

    it("상단 \"R&D Operations 시작하기\" CTA 제거 (히어로 영역)", () => {
      // 단, 비교 표 헤더는 별도 검사
      expect(PRICING_SRC).not.toMatch(/R&amp;D Operations 시작하기/);
    });
  });

  describe("pricing/page.tsx 월간/연간 토글 + 카드 정합", () => {
    it("월간/연간 토글 보존 (10% 할인 표기)", () => {
      expect(PRICING_SRC).toMatch(/월간/);
      expect(PRICING_SRC).toMatch(/연간/);
      expect(PRICING_SRC).toMatch(/10% 할인/);
    });

    it("featured regex 새 추천 \"가장 많이 선택\" 매칭", () => {
      expect(PRICING_SRC).toMatch(/\/가장\\s\*많이\\s\*선택\//);
    });

    it("featured regex 기존 \"단일 연구실\" 매칭 0", () => {
      expect(PRICING_SRC).not.toMatch(/\/단일\\s\*연구실\//);
    });
  });

  describe("pricing/page.tsx 비교 표 헤더 4 티어 정합", () => {
    it("비교 표 \"Free\" 헤더 존재", () => {
      expect(PRICING_SRC).toMatch(/>Free</);
    });

    it("비교 표 \"Basic\" 헤더 존재", () => {
      expect(PRICING_SRC).toMatch(/>Basic</);
    });

    it("비교 표 \"Pro\" 헤더 존재 (R&D Operations → Pro)", () => {
      expect(PRICING_SRC).toMatch(/>Pro</);
    });

    it("비교 표 기존 헤더 (\"Starter\" / \"Lab Team\" / \"R&D Operations\") 제거", () => {
      // pricing 페이지에서 기존 헤더 literal 0
      expect(PRICING_SRC).not.toMatch(/>Starter</);
      expect(PRICING_SRC).not.toMatch(/>Lab Team</);
      // pricing/page.tsx 의 jsx text 으로 R&D Operations 사용 0
      // (descriptor.label 이 source 이므로 더 이상 hardcode 0)
    });
  });

  describe("lib/plans.ts PLAN_DISPLAY 정합", () => {
    it("FREE.displayName = \"Free\"", () => {
      expect(PLANS_SRC).toMatch(/SubscriptionPlan\.FREE\]:\s*\{[\s\S]*?displayName:\s*"Free"/);
    });

    it("TEAM.displayName = \"Basic\"", () => {
      expect(PLANS_SRC).toMatch(/SubscriptionPlan\.TEAM\]:\s*\{[\s\S]*?displayName:\s*"Basic"/);
    });

    it("ORGANIZATION.displayName = \"Pro\"", () => {
      expect(PLANS_SRC).toMatch(
        /SubscriptionPlan\.ORGANIZATION\]:\s*\{[\s\S]*?displayName:\s*"Pro"/,
      );
    });

    it("getPlanDisplayName fallback \"Free\" (\"Starter\" → \"Free\")", () => {
      expect(PLANS_SRC).toMatch(/displayName\s*\?\?\s*"Free"/);
    });

    it("ENTERPRISE_INFO features 선두 \"Pro 전체 +\"", () => {
      expect(PLANS_SRC).toMatch(/"Pro 전체 \+"/);
    });
  });

  describe("4 caller file PLAN_LABELS / PLAN_MAP 정합", () => {
    it("billing/page.tsx PLAN_LABELS: starter=Free / team=Basic / business=Pro", () => {
      expect(BILLING_PAGE_SRC).toMatch(/starter:\s*"Free"/);
      expect(BILLING_PAGE_SRC).toMatch(/team:\s*"Basic"/);
      expect(BILLING_PAGE_SRC).toMatch(/business:\s*"Pro"/);
    });

    it("dashboard/page.tsx PLAN_INTENT_LABELS: starter=Free / team=Basic / business=Pro", () => {
      expect(DASHBOARD_PAGE_SRC).toMatch(/starter:\s*"Free"/);
      expect(DASHBOARD_PAGE_SRC).toMatch(/team:\s*"Basic"/);
      expect(DASHBOARD_PAGE_SRC).toMatch(/business:\s*"Pro"/);
    });

    it("settings/plans/page.tsx PLAN_INTENT_LABELS 정합", () => {
      expect(SETTINGS_PLANS_SRC).toMatch(/starter:\s*"Free"/);
      expect(SETTINGS_PLANS_SRC).toMatch(/team:\s*"Basic"/);
      expect(SETTINGS_PLANS_SRC).toMatch(/business:\s*"Pro"/);
    });

    it("organizations/page.tsx PLAN_MAP: FREE=Free / TEAM=Basic / ORGANIZATION=Pro", () => {
      expect(ORGS_PAGE_SRC).toMatch(/FREE:\s*\{\s*label:\s*"Free"/);
      expect(ORGS_PAGE_SRC).toMatch(/TEAM:\s*\{\s*label:\s*"Basic"/);
      expect(ORGS_PAGE_SRC).toMatch(/ORGANIZATION:\s*\{\s*label:\s*"Pro"/);
    });

    it("organizations/[id]/page.tsx planLabel: ORGANIZATION→Pro / TEAM→Basic / else→Free", () => {
      expect(ORG_DETAIL_SRC).toMatch(
        /plan === "ORGANIZATION" \? "Pro" : \(organization as any\)\.plan === "TEAM" \? "Basic" : "Free"/,
      );
    });
  });
});
