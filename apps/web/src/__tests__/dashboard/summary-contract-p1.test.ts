/**
 * §main-dashboard-redesign P1 — /api/dashboard/summary 단일 진실 계약 sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P1: 데이터 계약 + 가짜 차트 제거)
 *
 * 검증:
 *   (A) 파생 helper 로직 단위 — allEmpty / budTone(§11.302 신호등) / usageRate / won.
 *   (B) summary route shape — MODULES{quote,po,receive,stock} + BUDGET + 파생, 읽기 전용.
 *   (C) 가드②: 목업 분포/가짜 차트 데이터 0 (helper·route 어디에도 hardcode 분포 없음).
 *   (D) 가드③: 전이맵 로컬 재정의 0 (summary 는 카운트 표시만, ALLOWED_*_TRANSITIONS 부재).
 *   (E) 회귀 0: helper 계약(modules/budget/derived) 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  deriveDashboardSummary,
  budTone,
  won,
  canonicalBudgetQuery,
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary-derive";
import { blockAfter, blockEnclosing, blockFrom } from "../_helpers/block-window";
import { stripComments } from "../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/dashboard/summary/route.ts";
const HELPER = "src/lib/dashboard/summary-derive.ts";
const RECEIVING_SCREEN = "src/app/dashboard/receiving/page.tsx";
/**
 * §comment-axis (2026-09-21 릴레이 판정) — **주석은 단언이 아니다.**
 *   존재 단언은 주석 제거본으로 한다. 주석이 대신 매칭되면 코드가 없는데도 통과한다.
 *   부재 단언 중 "주석에도 남기면 안 된다" 는 것은 일부러 원문(read)을 본다 — 각 자리에 적어 둔다.
 */
function code(rel: string): string {
  return stripComments(read(rel));
}

function emptyInput(): DashboardSummaryInput {
  return {
    quote: { total: 0, pending: 0, responded: 0, completed: 0, purchased: 0, pendingAmount: 0 },
    po: { total: 0, ordered: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, confirmedAmount: 0, thisMonth: 0 },
    // §receive-canonical 2026-09-20 — ReceivingDraft 상태로 교체(호영님 판정).
    receive: { total: 0, awaitingReply: 0, pendingReview: 0, approved: 0, expiringCount: 0 },
    stock: { total: 0, reorderNeeded: 0, lowStock: 0, expiringCount: 0, assetValue: 0 },
    budget: null,
    spend: { thisMonth: 0 },
  };
}

// ── (A) 파생 helper 로직 단위 ──────────────────────────────────────────
describe("§main-dashboard-redesign P1 (A) — 파생 helper 로직", () => {
  it("빈 입력 → allEmpty=true, budTone=none, usageRate=0 (가드① 상류 신호)", () => {
    const s = deriveDashboardSummary(emptyInput());
    expect(s.derived.allEmpty).toBe(true);
    expect(s.derived.budTone).toBe("none");
    expect(s.budget.isSet).toBe(false);
    expect(s.budget.usageRate).toBe(0);
  });

  it("모듈 1건+ → allEmpty=false", () => {
    const input = emptyInput();
    input.quote.total = 1;
    expect(deriveDashboardSummary(input).derived.allEmpty).toBe(false);
  });

  it("spend.thisMonth 통과(StatLine 이번달 지출 소스, 실데이터/0)", () => {
    const input = emptyInput();
    input.spend.thisMonth = 1_500_000;
    expect(deriveDashboardSummary(input).spend.thisMonth).toBe(1_500_000);
    expect(deriveDashboardSummary(emptyInput()).spend.thisMonth).toBe(0);
  });

  it("budget 설정 시 usageRate 계산 + isSet=true", () => {
    const input = emptyInput();
    input.budget = { limit: 1_000_000, spent: 500_000, remaining: 500_000, periodEnd: null };
    const s = deriveDashboardSummary(input);
    expect(s.budget.isSet).toBe(true);
    expect(s.budget.usageRate).toBe(50);
    // §budget-period-axis — 선언이 없으면 null 그대로 통과시킨다(소비측이 폴백을 정한다).
    expect(s.budget.periodEnd).toBeNull();

    input.budget = { ...input.budget, periodEnd: "2026-12-31" };
    expect(deriveDashboardSummary(input).budget.periodEnd).toBe("2026-12-31");
  });

  it("budTone §11.302 신호등 임계 — <80 ok / 80–<100 warn / >=100 danger / 미설정 none", () => {
    expect(budTone(false, 0)).toBe("none");
    expect(budTone(true, 50)).toBe("ok");
    expect(budTone(true, 79.9)).toBe("ok");
    expect(budTone(true, 80)).toBe("warn");
    expect(budTone(true, 99.9)).toBe("warn");
    expect(budTone(true, 100)).toBe("danger");
    expect(budTone(true, 130)).toBe("danger");
  });

  it("won 포맷 — 원화 천단위 + 음수/소수 안전", () => {
    expect(won(1_234_567)).toBe("₩1,234,567");
    expect(won(0)).toBe("₩0");
    expect(won(-5000)).toBe("₩-5,000");
    expect(won(1234.6)).toBe("₩1,235");
  });
});

// ── (B) summary route shape ────────────────────────────────────────────
describe("§main-dashboard-redesign P1 (B) — summary route 계약", () => {
  it("GET handler + auth 가드 + 읽기 전용(force-dynamic)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/Unauthorized/);
    expect(src).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("deriveDashboardSummary 로 단일 진실 반환 (분포 가공 없이 helper 위임)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/deriveDashboardSummary\(/);
    expect(src).toMatch(/NextResponse\.json\(deriveDashboardSummary\(/);
  });

  it("MODULES 4종 + BUDGET 입력 구성", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quote:\s*\{/);
    expect(src).toMatch(/po:\s*\{/);
    expect(src).toMatch(/receive:\s*\{/);
    expect(src).toMatch(/stock:\s*\{/);
    expect(src).toMatch(/budget:\s*budgetInput/);
    expect(src).toMatch(/spend:\s*\{\s*thisMonth:\s*thisMonthSpend/);
  });

  it("prod write 0 — mutation 메서드 부재(읽기 endpoint)", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/);
  });
});

// ── (C) 가드② 가짜 분포 0 ──────────────────────────────────────────────
describe("§main-dashboard-redesign P1 (C) — 가드② 가짜 차트/분포 0", () => {
  it("helper 에 hardcode 월별/분포 mock 배열 없음", () => {
    const src = read(HELPER);
    expect(src).not.toMatch(/MOCKUP/);
    expect(src).not.toMatch(/\d{1,2}월"?\s*,\s*amount/);
  });
  it("route 에 hardcode 분포 mock 없음", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/MOCKUP/);
  });
});

// ── (D) 가드③ 전이맵 로컬 재정의 0 ─────────────────────────────────────
describe("§main-dashboard-redesign P1 (D) — 가드③ Pipeline 전이 로컬 재정의 0", () => {
  it("summary route/helper 에 ALLOWED_*_TRANSITIONS 로컬 정의 없음", () => {
    expect(read(ROUTE)).not.toMatch(/ALLOWED_\w+_TRANSITIONS/);
    expect(read(HELPER)).not.toMatch(/ALLOWED_\w+_TRANSITIONS/);
  });
});

// ── (E) 회귀 0 — helper 계약 보존 ──────────────────────────────────────
describe("§main-dashboard-redesign P1 (E) — helper 계약 회귀 0", () => {
  it("출력 구조 modules/budget/spend/derived 보존", () => {
    const s = deriveDashboardSummary(emptyInput());
    expect(Object.keys(s).sort()).toEqual(["budget", "derived", "modules", "spend"]);
    expect(Object.keys(s.modules).sort()).toEqual(["po", "quote", "receive", "stock"]);
    // §budget-period-axis (P1-5) — periodEnd 추가. 계약 확장이므로 이 목록도 함께 움직인다.
    expect(Object.keys(s.budget).sort()).toEqual([
      "isSet",
      "limit",
      "periodEnd",
      "remaining",
      "spent",
      "usageRate",
    ]);
    expect(Object.keys(s.derived).sort()).toEqual(["allEmpty", "budTone"]);
  });
});

// ── (F) §receive-canonical — 입고 정본은 ReceivingDraft (호영님 판정 2026-09-20) ──
//   명제: "칩이 판정하는 집합 = 칩이 여는 화면이 보여주는 집합".
//   두 곳에 같은 상수를 적어 두면 한쪽만 바뀌어도 통과한다 — 그래서 **화면 파일에서 읽어와** 비교한다.
describe("§receive-canonical — 입고 칩 판정과 화면이 같은 것을 센다", () => {
  /** route 의 receivingDraft 질의 2개(groupBy/count) 본문 창. */
  function receivingQueryBlocks(src: string): string[] {
    return ["db.receivingDraft.groupBy(", "db.receivingDraft.count("].map((tok) => {
      expect(src, `summary route 에 ${tok} 가 없다`).toContain(tok);
      return blockAfter(src, tok);
    });
  }
  /** `in: ["A", "B"]` 의 원소 집합. */
  function statusSet(block: string): string[] {
    const m = block.match(/in:\s*\[([^\]]*)\]/);
    expect(m, "status in:[...] 배열을 찾지 못했다").not.toBeNull();
    return (m![1].match(/"([A-Z_]+)"/g) ?? []).map((q) => q.replace(/"/g, "")).sort();
  }

  it("① 입고 카운트 소스는 receivingDraft 다 — 이 라우트에 inventoryRestock 0", () => {
    expect(code(ROUTE)).toContain("db.receivingDraft.groupBy(");
    expect(code(ROUTE)).toContain("db.receivingDraft.count(");
    // 🛑 여기만 **원문**이다 — 은퇴한 식별자는 주석에도 남기면 안 된다(§comment-axis 예외, 의도).
    expect(read(ROUTE)).not.toMatch(/inventoryRestock/);
  });

  it("② 질의 2개의 status 집합이 서로 같고 · 화면이 거는 집합과도 같다", () => {
    const [g, c] = receivingQueryBlocks(code(ROUTE));
    const fromRoute = statusSet(g);
    expect(statusSet(c)).toEqual(fromRoute);

    // 화면: /api/receiving-drafts?status=A,B,C
    const screen = code(RECEIVING_SCREEN);
    const q = screen.match(/receiving-drafts\?status=([A-Z_,]+)/);
    expect(q, "입고 화면에서 status 질의 문자열을 찾지 못했다").not.toBeNull();
    const fromScreen = q![1].split(",").filter(Boolean).sort();

    expect(fromRoute).toEqual(fromScreen);
    // 검출력: 집합이 비면 위 비교가 공허하게 통과한다.
    expect(fromRoute.length).toBeGreaterThan(0);
  });

  it("③ 판정 범위도 화면과 같다 — 본인 단독이 아니라 조직 포함", () => {
    const src = code(ROUTE);
    const [g, c] = receivingQueryBlocks(src);
    for (const [name, b] of [["groupBy", g], ["count", c]] as const) {
      expect(b, `${name} 질의가 userId 단독 범위다`).toContain("receivingOwnerWhere");
    }
    // receivingOwnerWhere 자체가 조직을 포함하는지 — 다른 모듈(견적·재고)과 같은 형태.
    const owner = blockAfter(src, "const receivingOwnerWhere");
    expect(owner).toContain("userId");
    expect(owner).toContain("organizationId");
  });

  it("④ APPROVED 는 정본 집합에 있고 · attention(조치 필요)에는 없다", () => {
    // 집합에는 있다 — 화면이 보여주니까.
    const [g] = receivingQueryBlocks(code(ROUTE));
    expect(statusSet(g)).toContain("APPROVED");
    // 파이프라인 attention 합산에는 없다 — 입고 확정은 할 일이 아니다(호영님 판정).
    //   창은 타입 선언이 아니라 **입고 스테이지 객체**다(첫 "attention:" 은 interface 쪽이다).
    const pipe = code("src/components/dashboard/pipeline.tsx");
    const stage = blockEnclosing(pipe, 'key: "receive"', "{");
    expect(stage, "pipeline 에 입고 스테이지 객체가 없다").toContain('href: "/dashboard/receiving"');
    const att = lineWith(stage, "attention:");
    expect(att).toContain("awaitingReply");
    expect(att).toContain("pendingReview");
    expect(att).not.toMatch(/\bapproved\b/);
  });
});

// ── (G) §budget-period-axis — 시간대 변환은 서버가 한 번만 한다 (P1-5) ──
describe("§budget-period-axis — 예산 기간 축은 한 곳에서만 굳는다", () => {
  it("① route 가 periodEnd 를 KST 달력 날짜로 굳혀 내려보낸다", () => {
    const src = code(ROUTE);
    expect(src).toContain("periodEnd");
    // 변환은 en-CA + Asia/Seoul — 저장소의 기존 패턴(resolvePeriodYearMonth · silence-window)과 같다.
    //   창은 헬퍼 안의 `DateTimeFormat(...)` **인자 괄호**다. `{` 로 열면 en-CA 가 창 앞에 남아 빠진다.
    const helperIdx = src.indexOf("const toKstCalendarDate");
    expect(helperIdx, "route 에 toKstCalendarDate 헬퍼가 없다").toBeGreaterThan(-1);
    const fmtIdx = src.indexOf("new Intl.DateTimeFormat(", helperIdx);
    expect(fmtIdx, "헬퍼 안에 DateTimeFormat 호출이 없다").toBeGreaterThan(-1);
    const conv = blockFrom(src, src.indexOf("(", fmtIdx), "(", ")");
    expect(conv).toContain("Asia/Seoul");
    expect(conv).toContain("en-CA");
  });

  // 🛑 정정 2026-09-21 — 옛 단언은 "폴백은 periodEnd 를 만들지 않는다(null)" 였다.
  //   그 전제(yearMonth 로 질의했으니 기간 끝 = 이번 달 말일)가 prod 실측으로 반증됐다.
  //   legacy Budget 도 description 에 실제 기간을 들고 있고, 그 기간은 이번 달을 넘어간다.
  it("② 폴백 예산도 **실제 기간**에서 periodEnd 를 만든다 — 기간 해석은 한 곳뿐", () => {
    const src = code(ROUTE);
    // 폴백 분기 창 안에서만 본다(활성 예산 분기와 섞이지 않게).
    const fb = blockAfter(src, "} else if (fallbackBudget");
    expect(fb, "폴백 분기를 찾지 못했다").toContain("limit: fallbackBudget.amount");
    // 창은 분기 전체다 — 기간을 지역 변수로 받아 쓰는 형태도 정답이다(값이 같은 곳에서 온다).
    expect(fb).toContain("resolveBudgetPeriod(fallbackBudget)");
    expect(lineWith(fb, "periodEnd:")).toContain("endCalendarDate");
    // null 로 되돌아가면 같은 결함이 되살아난다.
    expect(fb).not.toMatch(/periodEnd:\s*null/);
  });

  it("⑤ 지출/표시 **창**을 만드는 곳은 모두 resolveBudgetPeriod 를 쓴다", () => {
    // §budget-period-axis: /api/budgets 목록이 창을 자기 정규식으로 만들던 마지막 자리였다(2026-09-21 이관).
    for (const rel of [
      ROUTE,
      "src/app/api/budgets/route.ts",
      "src/app/api/orders/route.ts",
      "src/app/api/user-budgets/route.ts",
    ]) {
      const src = code(rel);
      expect(src, `${rel} · resolveBudgetPeriod 를 안 쓴다`).toContain("resolveBudgetPeriod(");
      expect(src, `${rel} · period 정규식을 직접 들고 있다`).not.toMatch(/match\(\/period:/);
    }
    // 정본은 하나 — 그 모듈만 정규식을 가진다.
    expect(code("src/lib/budget/budget-period.ts")).toMatch(/period:\(/);
  });

  it("⑤-b /api/budgets/[id] 의 **합산 창**도 모듈에서 온다 (원문 파싱 2곳은 별개 명제)", () => {
    // 🛑 이 파일은 period 정규식을 2곳 더 들고 있고, 그것은 이관 대상이 아니다 —
    //    GET:152 는 "저장된 값이 있는가"(없으면 null)를, PATCH:280 은 수정 시 **원문 문자열 보존**을
    //    묻는다. resolveBudgetPeriod 는 항상 월 창으로 낙하하므로 그 물음에 답할 수 없다.
    //    창(window)만 모듈에서 와야 한다 — 그것이 ⑤의 명제다.
    const src = code("src/app/api/budgets/[id]/route.ts");
    expect(src).toContain("resolveBudgetPeriod(budget)");
    // 창을 만드는 분해는 모듈 호출에서만 나온다.
    expect(lineWith(src, "resolveBudgetPeriod(budget)")).toMatch(/periodStart.*periodEnd/);
  });

  it("⑦ endCalendarDate 는 문자열로 조립한다 — Date 왕복 0", () => {
    // 🛑 사각지대 고지: "왕복하면 하루 어긋난다" 는 **러너 시간대에 따라** 드러나기도 안 드러나기도 한다
    //    (UTC·KST 에서는 같은 값이 나온다). 그래서 값이 아니라 **형태**로 막는다.
    const src = code("src/lib/budget/budget-period.ts");
    const lines = src.split(/\r?\n/).filter((l) => l.includes("endCalendarDate"));
    expect(lines.length).toBeGreaterThan(1); // 명시 창 · 월 창 두 자리
    for (const l of lines) {
      expect(l, `endCalendarDate 를 Date 왕복으로 만든다: ${l.trim()}`).not.toMatch(
        /toISOString|toLocaleDateString|DateTimeFormat/,
      );
    }
  });

  it("⑧ 폴백 예산의 기간과 소진액이 **같은 축** 위에 선다 (카드 내부 모순 0)", () => {
    const fb = blockAfter(code(ROUTE), "} else if (fallbackBudget");
    expect(fb, "폴백 분기를 찾지 못했다").toContain("limit: fallbackBudget.amount");
    // 창: resolveBudgetPeriod · 키: 예산 관리 화면과 같은 helper
    expect(fb).toContain("resolveBudgetPeriod(fallbackBudget)");
    expect(fb).toContain("resolveBudgetPurchaseScopeKeys(fallbackBudget)");
    expect(fb).toMatch(/purchasedAt:\s*\{\s*gte:[^}]*periodStart[\s\S]{0,60}periodEnd/);
    // 🛑 이번 달치만 세던 옛 산식이 되살아나면 RED — 기간은 분기인데 소진은 한 달이 된다.
    expect(lineWith(fb, "spent:")).not.toContain("thisMonthSpend");
    expect(lineWith(fb, "remaining:")).not.toContain("thisMonthSpend");
  });

  it("⑨ `spend.thisMonth` 는 예산과 무관한 축으로 남는다 — 섞지 않는다", () => {
    const src = code(ROUTE);
    expect(lineWith(src, "spend: {")).toContain("thisMonthSpend");
  });

  it("⑥ 폴백 질의에도 결정적 정렬이 있다 — 실제로 쓰이는 경로다", () => {
    const fb = blockAfter(code(ROUTE), "db.budget.findFirst(");
    expect(fb).toContain("yearMonth: currentYearMonth");
    expect(fb, "폴백 질의에 정렬이 없다 — 여러 scopeKey 를 조회하므로 미정이 남는다").toContain("orderBy");
    expect(fb).toContain("createdAt");
  });

  it("③ 카드의 세 지표가 **같은 now 하나**를 본다 — 자정을 넘기며 어긋나지 않는다", () => {
    const src = code("src/components/dashboard/budget-spend-card.tsx");
    expect(src).toMatch(/const now = new Date\(\);/);
    expect(lineWith(src, "budgetPace(")).toContain("now");
    expect(lineWith(src, "budgetPeriodLabel(")).toContain("now");
    // 라벨이 달력 이번 달을 직접 읽어 만들던 옛 형태가 되살아나면 RED.
    expect(src).not.toMatch(/getMonth\(\)\s*\+\s*1\}월/);
  });

  it("④ 축 계산은 p0-display 한 곳뿐 — route·카드에 로컬 말일 계산 0", () => {
    for (const rel of [ROUTE, "src/components/dashboard/budget-spend-card.tsx"]) {
      const src = code(rel);
      // `new Date(y, m + 1, 0)` = 말일 구하기 관용구. 축을 두 곳에서 세면 또 어긋난다.
      expect(src, `${rel} · 말일 계산이 복제됐다`).not.toMatch(/new Date\([^)]*\+\s*1\s*,\s*0\s*\)/);
    }
  });
});

// ── (H) §budget-canonical-pick — 정본 예산 선택은 미정을 남기지 않는다 (P1-9) ──
//   실측 결함(2026-09-21): 활성 예산 2건에 정렬이 없어, 집행 0% 검증용이 뽑히고
//   실제 운영 예산(17% 집행)이 화면에서 사라졌다.
//   🛑 규칙을 정규식으로 더듬지 않는다 — 질의 인자를 **값으로** 잰다.
describe("§budget-canonical-pick — 오늘이 기간 안에 드는 것 중 가장 최근 시작분", () => {
  const NOW = new Date("2026-09-21T00:00:00.000Z");

  it("① 질의 인자 전체 — 기간 필터 + 결정적 정렬", () => {
    expect(canonicalBudgetQuery("u1", NOW)).toEqual({
      where: {
        userId: "u1",
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: NOW } }] },
          { OR: [{ endDate: null }, { endDate: { gte: NOW } }] },
        ],
      },
      orderBy: [
        { startDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    });
  });

  it("② 동점을 가르는 2차 정렬이 있다 — 미정이 남으면 이번 결함이 되풀이된다", () => {
    const { orderBy } = canonicalBudgetQuery("u1", NOW);
    expect(orderBy.length).toBeGreaterThan(1);
    expect(JSON.stringify(orderBy[1])).toContain("createdAt");
  });

  it("③ 날짜 미선언(null)은 통과시킨다 — 날짜 없이 만든 기존 예산이 사라지면 안 된다", () => {
    const conds = JSON.stringify(canonicalBudgetQuery("u1", NOW).where.AND);
    expect(conds).toContain('"startDate":null');
    expect(conds).toContain('"endDate":null');
  });

  it("④ route 는 규칙을 스스로 짓지 않고 이 함수를 쓴다 — 규칙은 한 곳뿐", () => {
    const src = code(ROUTE);
    expect(src).toContain("db.userBudget.findFirst(canonicalBudgetQuery(");
    // 인라인으로 되돌아가면(= where 를 route 가 직접 짜면) RED.
    expect(src).not.toMatch(/userBudget\.findFirst\(\s*\{/);
  });
});

/** 주어진 창 안에서 `token` 이 포함된 첫 줄. 줄 번호가 아니라 토큰으로 찾는다. */
function lineWith(scope: string, token: string): string {
  const line = scope.split(/\r?\n/).find((l) => l.includes(token));
  expect(line, `${token} 를 포함한 줄이 없다`).toBeTruthy();
  return line!;
}
