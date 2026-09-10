/**
 * §billing-redesign P4: 플랜 비교표 + 기능 리스트 단일화 (호영님 핸드오프 2026-09-08).
 *
 * 닫는 결함: 플랜 3카드가 각자 기능을 나열해 "무엇이 다른가" 를 읽는 사람이 조합해야 했다.
 *   행=기능 · 열=플랜 표로 바꾸고, 플랜별 기능 리스트 카드는 삭제한다(단일 소스).
 *
 * 🛑 값은 시안이 아니라 PLAN_LIMITS / PLAN_DESCRIPTOR 에서 파생한다.
 *   2026-09-10 실측으로 시안과 두 곳이 어긋났고, 시안을 그대로 옮기면 화면이 거짓을 말한다:
 *   ① 시안은 재고 품목이 Basic/Pro "무제한" 이라 했지만 실제 한도는 50 / 200 이다.
 *   ② 시안의 "요청·구매 진행 추적" 에 대응하는 entitlement 가 없다.
 *      Free X / Basic O / Pro O 패턴을 실제로 만족하는 플래그는 `exportPack` 뿐이다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SubscriptionPlan, PLAN_LIMITS } from "@/lib/plans";
import { PLAN_DESCRIPTOR } from "@/lib/billing/plan-descriptor";
import {
  COMPARISON_PLANS,
  COMPARISON_ROWS,
  planLabel,
  planPriceLabel,
} from "@/lib/billing/plan-comparison";
import { violations } from "../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PAGE = read("src/app/billing/page.tsx");
const LIB = read("src/lib/billing/plan-comparison.ts");

const cell = (rowKey: string, plan: (typeof COMPARISON_PLANS)[number]) =>
  COMPARISON_ROWS.find((r) => r.key === rowKey)!.cell(plan);

describe("§billing-redesign P4: 비교표 값은 정본 파생", () => {
  it("3개 플랜 · 5개 행", () => {
    expect(COMPARISON_PLANS).toEqual([
      SubscriptionPlan.FREE,
      SubscriptionPlan.TEAM,
      SubscriptionPlan.ORGANIZATION,
    ]);
    expect(COMPARISON_ROWS).toHaveLength(5);
  });

  it("플랜 라벨·가격은 PLAN_DESCRIPTOR / PLAN_PRICES 파생", () => {
    expect(planLabel(SubscriptionPlan.FREE)).toBe("Free");
    expect(planLabel(SubscriptionPlan.TEAM)).toBe("Basic");
    expect(planLabel(SubscriptionPlan.ORGANIZATION)).toBe("Pro");
    expect(planPriceLabel(SubscriptionPlan.FREE)).toBe("무료");
    expect(planPriceLabel(SubscriptionPlan.TEAM)).toBe("₩89,000/월");
    expect(planPriceLabel(SubscriptionPlan.ORGANIZATION)).toBe("₩259,000/월");
  });

  it("견적 요청 = maxQuotesPerMonth", () => {
    expect(cell("quotes", SubscriptionPlan.FREE)).toBe("3건/월");
    expect(cell("quotes", SubscriptionPlan.TEAM)).toBe("무제한");
    expect(cell("quotes", SubscriptionPlan.ORGANIZATION)).toBe("무제한");
  });

  it("운영자 시트 = maxMembers + 추가 좌석 단가(구조화 필드)", () => {
    expect(cell("seats", SubscriptionPlan.FREE)).toBe("1명");
    expect(cell("seats", SubscriptionPlan.TEAM)).toBe("3명 · 추가 ₩35,000/월/명");
    expect(cell("seats", SubscriptionPlan.ORGANIZATION)).toBe("10명 · 추가 ₩28,000/월/명");
  });

  it("추가 좌석 단가는 features 문구와 같은 수를 말한다", () => {
    expect(PLAN_DESCRIPTOR.team.additionalSeatPriceKrw).toBe(35_000);
    expect(PLAN_DESCRIPTOR.business.additionalSeatPriceKrw).toBe(28_000);
    expect(PLAN_DESCRIPTOR.team.features.join(" ")).toContain("₩35,000");
    expect(PLAN_DESCRIPTOR.business.features.join(" ")).toContain("₩28,000");
    expect(PLAN_DESCRIPTOR.starter.additionalSeatPriceKrw).toBeNull();
  });

  it("재고·스캔은 실제 한도 (시안의 '무제한' 미채택)", () => {
    expect(cell("inventory", SubscriptionPlan.FREE)).toBe("10품목 · 10회/월");
    expect(cell("inventory", SubscriptionPlan.TEAM)).toBe("50품목 · 무제한");
    expect(cell("inventory", SubscriptionPlan.ORGANIZATION)).toBe("200품목 · 무제한");
    // 정본이 무제한이 아님을 못박는다: 여기 값이 바뀌면 표도 따라 바뀌어야 한다.
    expect(PLAN_LIMITS[SubscriptionPlan.TEAM].maxItems).toBe(50);
    expect(PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxItems).toBe(200);
  });

  it("제공/미제공 행은 features 플래그 파생", () => {
    expect(cell("exportPack", SubscriptionPlan.FREE)).toBeNull();
    expect(cell("exportPack", SubscriptionPlan.TEAM)).toBe(true);
    expect(cell("approval", SubscriptionPlan.FREE)).toBeNull();
    expect(cell("approval", SubscriptionPlan.TEAM)).toBeNull();
    expect(cell("approval", SubscriptionPlan.ORGANIZATION)).toBe("1단계");
  });
});

describe("§billing-redesign P4: 화면 계약", () => {
  it("3카드 기능 리스트 삭제, 비교표가 단일 소스", () => {
    expect(PAGE).not.toMatch(/plan\.features\.slice/);
    expect(PAGE).not.toMatch(/플랜 업그레이드/);
    expect(PAGE).toMatch(/플랜 비교/);
    expect(PAGE).toMatch(/월 결제 · VAT 별도/);
  });

  it("행·열은 lib 정의를 돌려 그린다 (표 값 하드코딩 0)", () => {
    expect(PAGE).toMatch(/from "@\/lib\/billing\/plan-comparison"/);
    expect(PAGE).toMatch(/COMPARISON_ROWS\.map/);
    expect(PAGE).toMatch(/COMPARISON_PLANS\.map/);
    expect(PAGE).not.toMatch(/₩89,000|₩35,000|50품목/);
  });

  it("현재 플랜 열 강조 + 액션 행", () => {
    expect(PAGE).toMatch(/isCurrent && "bg-\[#f8fafc\]"/);
    expect(PAGE).toMatch(/현재/);
    expect(PAGE).toMatch(/사용 중/);
    expect(PAGE).toMatch(/업그레이드/);
    expect(PAGE).toMatch(/영업팀 문의/);
  });

  it("미제공 표기·제공 표기 토큰", () => {
    expect(PAGE).toMatch(/text-\[#cbd5e1\]/);
    expect(PAGE).toMatch(/text-\[#15803d\]/);
  });

  it("호출자 0 이 된 upgradeMutation 은 남기지 않는다", () => {
    expect(PAGE).not.toMatch(/const upgradeMutation = useMutation/);
    expect(PAGE).not.toMatch(/업그레이드 완료/);
  });

  it("em dash 조항: 화면 문구 구분자 0 (미제공 표기는 placeholder)", () => {
    expect(violations(PAGE)).toHaveLength(0);
    expect(violations(LIB)).toHaveLength(0);
  });
});
