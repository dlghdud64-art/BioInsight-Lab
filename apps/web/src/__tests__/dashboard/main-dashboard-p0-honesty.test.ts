/**
 * §main-dashboard-p0-honesty — 대시보드 P0 정직성 역계약
 *
 * 정본: docs/plans/PLAN_main-dashboard-p0-honesty.md
 *       메인 대시보드 핸드오프.md (호영님 2026-09-17)
 *
 * 두 축으로 나눠 단언한다. 축을 섞지 않는다.
 *   축 A 행동  — src/lib/dashboard/p0-display.ts 순수 파생. 명제를 직접 잰다.
 *   축 B 구조  — 정규식 sentinel. 파일에서 사라져야 할 것/배선돼야 할 것만.
 *
 * 축 B 의 창은 전부 **블록 경계**로 연다(고정 폭 슬라이스 0 · 4원칙 ⑤).
 *
 * 은퇴 승계(명제 이관):
 *   §dashboard-home-redesign P3 visual-p3 의 "진행바 폭 = total/maxTotal" 명제는
 *     본 파일 B4 가 **역방향으로** 승계한다(게이지 폐지). 같은 파일의 살아있는 명제
 *     "§11.302 amber/orange 0" · "0건 value slate-500" 은 B7 이 승계한다.
 *   §11.175/§11.176/§11.181 의 "dashboard surface 가 FAB 를 mount" 명제는 B6 가
 *     역방향으로 승계한다. FAB 컴포넌트 자체(floating-entry.tsx)의 명제
 *     (popup self-contained · bottom 위치 · onClick 부재)는 원 파일이 계속 소유한다
 *     — 컴포넌트는 dormant 보존이므로 은퇴 대상이 아니다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  budgetStatDisplay,
  shouldRenderCategoryDonut,
  buildPipelineChips,
  budgetPace,
  type CategorySlice,
} from "@/lib/dashboard/p0-display";
import { budTone, deriveDashboardSummary } from "@/lib/dashboard/summary-derive";
import { violations } from "../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const STAT_LINE = "src/components/dashboard/stat-line.tsx";
const BUDGET_CARD = "src/components/dashboard/budget-spend-card.tsx";
const PIPELINE = "src/components/dashboard/pipeline.tsx";
const PAGE = "src/app/dashboard/page.tsx";
const MOBILE = "src/components/dashboard/mobile-dashboard-view.tsx";
const BANNER = "src/components/dashboard/next-step-banner.tsx";
const INBOX = "src/components/dashboard/action-inbox.tsx";
const GLOBAL_EMPTY = "src/components/dashboard/global-empty.tsx";
const RECENT = "src/components/dashboard/recent-activity-card.tsx";
const TREND = "src/components/dashboard/spend-trend-card.tsx";
const CATEGORY = "src/components/dashboard/category-distribution-card.tsx";

/**
 * §main-dashboard-p0-honesty Smoke A (2026-09-20) — **표면 목록 확대**.
 *   최초 5파일(값을 고친 것들)만 봤는데, prod 화면을 눈으로 보자 NextStepBanner 의
 *   em dash 가 그대로 떠 있었다. 고친 파일이 아니라 **한 화면에 함께 렌더되는 파일 전부**가
 *   조항의 축이다. 정적 단언이 화면보다 좁으면 Smoke 가 그 차이를 메운다 — 그게 이번에 일어났다.
 */
const SURFACES = [
  STAT_LINE, BUDGET_CARD, PIPELINE, PAGE, MOBILE,
  BANNER, INBOX, GLOBAL_EMPTY, RECENT, TREND, CATEGORY,
];

/** 여는 토큰부터 대응 닫는 중괄호까지 — 길이에 좌우되지 않는 창(4원칙 ⑤). */
function blockFrom(src: string, openIdx: number, open = "{", close = "}"): string {
  if (openIdx < 0) return "";
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx);
}

// ═══════════════════════════════════════════════════════════════
// 축 A — 행동 (순수 파생. 명제를 직접 잰다)
// ═══════════════════════════════════════════════════════════════

describe("A1 예산 미설정 시 금액을 만들지 않는다 (핸드오프 §0-1)", () => {
  /** 포맷 함수가 호출되면 기록한다 — "₩0 을 안 그린다" 가 아니라 "금액을 안 만든다". */
  function tracker() {
    const calls: number[] = [];
    return { calls, fn: (n: number) => (calls.push(n), `WON_${n}`) };
  }

  it("미설정 · 지출 = 집계 전 · 포맷 함수 호출 0", () => {
    const t = tracker();
    const d = budgetStatDisplay("spend", 0, false, t.fn);
    expect(d.mode).toBe("pending");
    expect(d.primary).toBe("집계 전");
    expect(d.helper).toBe("첫 발주 완료 후 표시");
    expect(t.calls).toHaveLength(0);
  });

  it("미설정 · 잔여 예산 = 설정 전 · 포맷 함수 호출 0", () => {
    const t = tracker();
    const d = budgetStatDisplay("remaining", 0, false, t.fn);
    expect(d.mode).toBe("pending");
    expect(d.primary).toBe("설정 전");
    expect(d.helper).toBe("예산 등록 후 표시");
    expect(t.calls).toHaveLength(0);
  });

  it("미설정인데 금액이 0이 아니어도 금액을 만들지 않는다", () => {
    const t = tracker();
    const d = budgetStatDisplay("spend", 44_634_000, false, t.fn);
    expect(d.mode).toBe("pending");
    expect(t.calls).toHaveLength(0);
  });

  it("설정됨 = 실금액 · 포맷 함수 1회 호출", () => {
    const t = tracker();
    const d = budgetStatDisplay("spend", 1_234_000, true, t.fn);
    expect(d.mode).toBe("amount");
    expect(d.primary).toBe("WON_1234000");
    expect(d.helper).toBeNull();
    expect(t.calls).toEqual([1_234_000]);
  });
});

describe("A2 카테고리 도넛 게이팅 (핸드오프 §0-2 · §5)", () => {
  const real: CategorySlice[] = [
    { category: "시약", amount: 30_000_000 },
    { category: "소모품", amount: 14_634_000 },
  ];

  it("예산 미설정이면 실분포가 있어도 렌더하지 않는다 (₩0 과 6개월 누계 공존 차단)", () => {
    expect(shouldRenderCategoryDonut(false, real)).toBe(false);
  });

  it("예산 설정 + 실분포 있음 = 렌더", () => {
    expect(shouldRenderCategoryDonut(true, real)).toBe(true);
  });

  it("예산 설정 + 빈 분포 = 미렌더 (가짜 분포 0)", () => {
    expect(shouldRenderCategoryDonut(true, [])).toBe(false);
    expect(shouldRenderCategoryDonut(true, undefined)).toBe(false);
  });

  it("예산 설정 + 전액 0 분포 = 미렌더", () => {
    expect(shouldRenderCategoryDonut(true, [{ category: "시약", amount: 0 }])).toBe(false);
  });
});

describe("A3 파이프라인 상태 칩 (핸드오프 §4)", () => {
  function summaryWith(over: {
    quote?: Partial<{ total: number; pending: number; responded: number }>;
    receive?: Partial<{ total: number; pending: number; partial: number; issue: number }>;
    stock?: Partial<{ total: number; lowStock: number; expiringCount: number; reorderNeeded: number }>;
  }) {
    return deriveDashboardSummary({
      quote: { total: 0, pending: 0, responded: 0, completed: 0, purchased: 0, pendingAmount: 0, ...over.quote },
      po: { total: 0, ordered: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, confirmedAmount: 0, thisMonth: 0 },
      receive: { total: 0, pending: 0, partial: 0, completed: 0, issue: 0, expiringCount: 0, ...over.receive },
      stock: { total: 0, reorderNeeded: 0, lowStock: 0, expiringCount: 0, assetValue: 0, ...over.stock },
      budget: null,
      spend: { thisMonth: 0 },
    });
  }

  it("0건 칩은 만들지 않는다 (dead button 0)", () => {
    const chips = buildPipelineChips(summaryWith({}));
    expect(chips.quote).toEqual([]);
    expect(chips.stock).toEqual([]);
    expect(chips.receive).toEqual([]);
  });

  it("견적 · 회신 대기(yellow) · 비교 중(gray)", () => {
    const chips = buildPipelineChips(summaryWith({ quote: { total: 5, pending: 3, responded: 2 } }));
    expect(chips.quote.map((c) => [c.label, c.count, c.tone])).toEqual([
      // Smoke D 실측(2026-09-20): 착지 화면이 이 단계를 `발송 대기` 로 부른다.
      ["발송 대기", 3, "yellow"],
      ["비교 중", 2, "gray"],
    ]);
  });

  it("재고 · 안전재고 미달(red) · 만료 임박(yellow)", () => {
    const chips = buildPipelineChips(summaryWith({ stock: { total: 9, lowStock: 1, expiringCount: 2 } }));
    expect(chips.stock.map((c) => [c.label, c.count, c.tone])).toEqual([
      ["안전재고 미달", 1, "red"],
      ["만료 임박", 2, "yellow"],
    ]);
  });

  it("🛑 입고 칩은 만들지 않는다 · 판정 소스와 착지 화면이 다른 테이블 (호영님 판정 2026-09-18)", () => {
    // 명제: 근거를 확인할 수 없는 상태 주장을 클릭 대상으로 내보내지 않는다.
    //   summary.receive = db.inventoryRestock · /dashboard/receiving = ReceivingDraft.
    //   미완료가 있든 전량 완료든 칩 0 — 어느 쪽도 착지 화면이 뒷받침하지 못한다.
    expect(buildPipelineChips(summaryWith({ receive: { total: 4, pending: 1, issue: 1 } })).receive).toEqual([]);
    expect(buildPipelineChips(summaryWith({ receive: { total: 4, completed: 4 } as never })).receive).toEqual([]);
  });

  it("칩 href 는 검증된 라우트 집합만 쓴다 (신규 dead route 0)", () => {
    const chips = buildPipelineChips(
      summaryWith({
        quote: { total: 5, pending: 3, responded: 2 },
        receive: { total: 4, pending: 1 },
        stock: { total: 9, lowStock: 1, expiringCount: 2 },
      }),
    );
    const hrefs = [...chips.quote, ...chips.receive, ...chips.stock].map((c) => c.href).sort();
    expect(hrefs).toEqual([
      "/dashboard/inventory?filter=lot_issue&tab=overview",
      "/dashboard/inventory?filter=low",
      "/dashboard/quotes?status=PENDING",
      "/dashboard/quotes?status=RESPONDED",
      // "/dashboard/receiving" 제거됨 (2026-09-18) — 판정 소스/착지 화면 테이블 불일치. P1 재검토.
    ]);
  });

  it("칩 톤 집합에 amber/orange 가 없다 (§11.302)", () => {
    const chips = buildPipelineChips(
      summaryWith({
        quote: { total: 5, pending: 3, responded: 2 },
        receive: { total: 4, pending: 1 },
        stock: { total: 9, lowStock: 1, expiringCount: 2 },
      }),
    );
    const tones = [...new Set([...chips.quote, ...chips.receive, ...chips.stock].map((c) => c.tone))].sort();
    expect(tones).toEqual(["gray", "red", "yellow"]);
  });
});

describe("A4 예산 톤 canonical 상속 · 로컬 재정의 0", () => {
  it("budTone 임계 (핸드오프 §5: 80% 주의 · 100% 위험)", () => {
    expect(budTone(false, 0)).toBe("none");
    expect(budTone(true, 79.9)).toBe("ok");
    expect(budTone(true, 80)).toBe("warn");
    expect(budTone(true, 99.9)).toBe("warn");
    expect(budTone(true, 100)).toBe("danger");
    expect(budTone(true, 140)).toBe("danger");
  });

  it("p0-display 는 예산 톤을 재정의하지 않는다", () => {
    const src = read("src/lib/dashboard/p0-display.ts");
    expect(src).not.toMatch(/function\s+budTone/);
    expect(src).not.toMatch(/usageRate\s*>=\s*(80|100)/);
  });
});

describe("A5 예산 소진 페이스 (핸드오프 §5 운영 상태 3지표)", () => {
  // now 를 주입받는다 — 시스템 시계에 의존하면 단언이 날짜마다 흔들린다.
  it("월 중간 · 남은 일수 = 말일 - 오늘 + 1", () => {
    expect(budgetPace(1_400_000, new Date(2026, 8, 17)).daysLeft).toBe(14); // 9월 30일까지
    expect(budgetPace(1_000_000, new Date(2026, 1, 10)).daysLeft).toBe(19); // 2026-02 는 28일
  });

  it("말일이면 남은 일수 1 (0 나눗셈 차단)", () => {
    const p = budgetPace(500_000, new Date(2026, 8, 30));
    expect(p.daysLeft).toBe(1);
    expect(p.dailyAllowance).toBe(500_000);
  });

  it("일평균 = 잔여 / 남은 일수 (내림)", () => {
    expect(budgetPace(1_400_000, new Date(2026, 8, 17)).dailyAllowance).toBe(100_000);
    // 🛑 나누어떨어지는 입력만 쓰면 내림을 지워도 GREEN 이다 — 검출력 0 단언이 된다
    //    (2026-09-18 operator-shell 실측: A5-pace-floor 프로브가 주입됐는데 통과했다).
    //    2026-02 는 28일 · 10일 기준 남은 19일 → 1,000,000 / 19 = 52631.57…
    expect(budgetPace(1_000_000, new Date(2026, 1, 10)).dailyAllowance).toBe(52_631);
  });

  it("예산 초과(잔여 음수)면 쓸 수 있는 돈을 만들지 않는다", () => {
    expect(budgetPace(-3_000_000, new Date(2026, 8, 17)).dailyAllowance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 축 B — 구조 (정규식 sentinel)
// ═══════════════════════════════════════════════════════════════

describe("B1 StatLine · 미설정 분기가 p0-display 계약을 쓴다", () => {
  it("budgetStatDisplay import", () => {
    expect(read(STAT_LINE)).toMatch(
      /import\s*\{[^}]*\bbudgetStatDisplay\b[^}]*\}\s*from\s*["']@\/lib\/dashboard\/p0-display["']/,
    );
  });
});

describe("B2 BudgetSpendCard · 도넛이 게이트 안에 있다", () => {
  it("shouldRenderCategoryDonut import", () => {
    expect(read(BUDGET_CARD)).toMatch(
      /import\s*\{[^}]*\bshouldRenderCategoryDonut\b[^}]*\}\s*from\s*["']@\/lib\/dashboard\/p0-display["']/,
    );
  });

  it("CategoryDistributionCard 렌더가 게이트 뒤에 온다 (무조건 렌더 0)", () => {
    const src = read(BUDGET_CARD);
    const gateIdx = src.indexOf("shouldRenderCategoryDonut(");
    const renderIdx = src.indexOf("<CategoryDistributionCard");
    expect(gateIdx, "게이트 호출 없음").toBeGreaterThan(-1);
    expect(renderIdx, "도넛 렌더 없음").toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(renderIdx);
  });
});

describe("B3 BudgetSpendCard · 미설정 분기에 CTA 0 (§dashboard-shifan-polish B4 승계)", () => {
  it("예산 설정 동선은 배너 단독 소유", () => {
    const src = read(BUDGET_CARD);
    const idx = src.indexOf("!isSet");
    expect(idx, "미설정 분기 없음").toBeGreaterThan(-1);
    const block = blockFrom(src, src.indexOf("{", idx));
    expect(block).not.toMatch(/<a\s/);
    expect(block).not.toMatch(/<Link\s/);
    expect(block).not.toMatch(/<button\s/);
  });
});

describe("B4 Pipeline · 게이지 폐지 (§dashboard-home-redesign P3 역방향 승계)", () => {
  const src = () => read(PIPELINE);

  it("maxTotal 분모 0", () => {
    expect(src()).not.toMatch(/\bmaxTotal\b/);
  });

  it("진행바 엘리먼트 0", () => {
    expect(src()).not.toMatch(/stage\.total\s*\/\s*/);
    expect(src()).not.toMatch(/<i\s+className/);
  });

  it("buildPipelineChips import (칩이 게이지를 대체)", () => {
    expect(src()).toMatch(
      /import\s*\{[^}]*\bbuildPipelineChips\b[^}]*\}\s*from\s*["']@\/lib\/dashboard\/p0-display["']/,
    );
  });
});

describe("B5 Pipeline · 칩 href 가 딥링크 (dead button 0)", () => {
  it("칩 렌더가 chip.href 를 그대로 쓴다", () => {
    const src = read(PIPELINE);
    expect(src).toMatch(/href=\{\s*chip\.href\s*\}/);
  });
});

describe("B6 대시보드 · 운영 브리핑 FAB 0 (핸드오프 §0-4 · §1)", () => {
  const src = () => read(PAGE);

  it("FAB 렌더 0", () => {
    expect(src()).not.toMatch(/<OperationalBriefFloatingEntry/);
  });

  it("FAB import 0 (dead import 0)", () => {
    expect(src()).not.toMatch(/from\s+["']@\/components\/operational-brief\/floating-entry["']/);
  });

  it("FAB 컴포넌트 파일은 dormant 보존 (다른 surface 가 쓴다)", () => {
    expect(() => read("src/components/operational-brief/floating-entry.tsx")).not.toThrow();
  });
});

describe("B7 회귀 · 신호등·타이포 (은퇴 sentinel 명제 승계)", () => {
  it.each(SURFACES)("%s · amber/orange 0 (§11.302)", (path) => {
    const src = read(path);
    expect(src).not.toMatch(/-amber-/);
    expect(src).not.toMatch(/-orange-/);
  });

  it.each(SURFACES)("%s · em dash 구분자 0 (파일 단위 판별기)", (path) => {
    expect(violations(read(path))).toHaveLength(0);
  });

  it("Pipeline 0건 value 가독성 slate-500 보존 (visual-p3 승계)", () => {
    expect(read(PIPELINE)).toMatch(/text-slate-500/);
  });
});

describe("B10 모바일 <768px — 핸드오프 §6", () => {
  // Smoke C 를 이 환경에서 못 돌려(resize 가 뷰포트에 반영되지 않음) 화면으로는 확인하지 못했다.
  // 실행 불가한 검사를 추정으로 통과시키지 않는다 — 대신 **핸드오프 원문 대조**로 정적 단언을 남긴다.
  it("파이프라인 3카드는 모바일에서 1열", () => {
    expect(read(PIPELINE)).toMatch(/grid-cols-1 md:grid-cols-3/);
    // 모바일에도 3열이 걸리면 375px 에서 카드 폭 ~110px 이라 상태 칩이 넘친다.
    expect(read(PIPELINE)).not.toMatch(/\?\s*"grid-cols-3"/);
  });
  it("2열 그리드는 모바일에서 1열(lg 이상에서만 2열)", () => {
    expect(read(PAGE)).toMatch(/grid-cols-1 lg:grid-cols-2/);
  });
});

describe("B9 §11.257 이관 명제 · 대시보드 모바일 보조 표면 회귀 0", () => {
  // §11.257(모바일 인라인 운영 브리핑 link)은 그 기능이 사라져 은퇴한다(FAB 제거 · 핸드오프 §0-4).
  //   그 파일이 붙잡고 있던 **살아있는 명제 2건**을 여기로 옮긴다. 은퇴가 명제를 데려가지 않게.
  it("모바일 하단 빠른 실행 바 보존 (시약 검색 · 재고 등록 · 견적 요청)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/시약\s*검색/);
    expect(src).toMatch(/재고 등록/);
    expect(src).toMatch(/견적 요청/);
    expect(src).toMatch(/fixed bottom-0[\s\S]{0,200}md:hidden/);
  });
  it("AIInsightDialog 헤더 mount 보존", () => {
    expect(read(PAGE)).toMatch(/<AIInsightDialog/);
  });
});

describe("B8 2열 그리드 · 우측 2카드 높이 정합 (핸드오프 §1-5 · §5)", () => {
  it("items-stretch 보존", () => {
    expect(read(PAGE)).toMatch(/grid[^"']*lg:grid-cols-2[^"']*items-stretch|items-stretch[^"']*lg:grid-cols-2/);
  });

  it("우측 컬럼이 세로 2장 flex-1", () => {
    const src = read(PAGE);
    const idx = src.indexOf("items-stretch");
    expect(idx, "2열 그리드 없음").toBeGreaterThan(-1);
    const block = src.slice(idx, src.indexOf("</div>", src.indexOf("<RecentActivityCard")) + 6);
    expect(block).toMatch(/flex\s+flex-col[\s\S]{0,4000}flex-1/);
  });
});
