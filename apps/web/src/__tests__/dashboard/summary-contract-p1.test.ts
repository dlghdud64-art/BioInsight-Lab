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
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary-derive";
import { blockAfter, blockEnclosing, blockFrom } from "../_helpers/block-window";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/dashboard/summary/route.ts";
const HELPER = "src/lib/dashboard/summary-derive.ts";
const RECEIVING_SCREEN = "src/app/dashboard/receiving/page.tsx";

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
    const src = read(ROUTE);
    expect(src).toContain("db.receivingDraft.groupBy(");
    expect(src).toContain("db.receivingDraft.count(");
    // 주석에 남아도 안 된다 — 은퇴한 식별자가 살아 있으면 다음 사람이 그리로 돌아간다.
    expect(src).not.toMatch(/inventoryRestock/);
  });

  it("② 질의 2개의 status 집합이 서로 같고 · 화면이 거는 집합과도 같다", () => {
    const [g, c] = receivingQueryBlocks(read(ROUTE));
    const fromRoute = statusSet(g);
    expect(statusSet(c)).toEqual(fromRoute);

    // 화면: /api/receiving-drafts?status=A,B,C
    const screen = read(RECEIVING_SCREEN);
    const q = screen.match(/receiving-drafts\?status=([A-Z_,]+)/);
    expect(q, "입고 화면에서 status 질의 문자열을 찾지 못했다").not.toBeNull();
    const fromScreen = q![1].split(",").filter(Boolean).sort();

    expect(fromRoute).toEqual(fromScreen);
    // 검출력: 집합이 비면 위 비교가 공허하게 통과한다.
    expect(fromRoute.length).toBeGreaterThan(0);
  });

  it("③ 판정 범위도 화면과 같다 — 본인 단독이 아니라 조직 포함", () => {
    const src = read(ROUTE);
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
    const [g] = receivingQueryBlocks(read(ROUTE));
    expect(statusSet(g)).toContain("APPROVED");
    // 파이프라인 attention 합산에는 없다 — 입고 확정은 할 일이 아니다(호영님 판정).
    //   창은 타입 선언이 아니라 **입고 스테이지 객체**다(첫 "attention:" 은 interface 쪽이다).
    const pipe = read("src/components/dashboard/pipeline.tsx");
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
    const src = read(ROUTE);
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

  it("② 월 단위 폴백 예산은 periodEnd 를 만들지 않는다 — 폴백 규칙과 답이 같다", () => {
    const src = read(ROUTE);
    // 폴백 분기 창 안에서만 본다(활성 예산 분기와 섞이지 않게).
    const fb = blockAfter(src, "} else if (fallbackBudget");
    expect(fb, "폴백 분기를 찾지 못했다").toContain("limit: fallbackBudget.amount");
    expect(lineWith(fb, "periodEnd:")).toContain("null");
  });

  it("③ 카드의 세 지표가 **같은 now 하나**를 본다 — 자정을 넘기며 어긋나지 않는다", () => {
    const src = read("src/components/dashboard/budget-spend-card.tsx");
    expect(src).toMatch(/const now = new Date\(\);/);
    expect(lineWith(src, "budgetPace(")).toContain("now");
    expect(lineWith(src, "budgetPeriodLabel(")).toContain("now");
    // 라벨이 달력 이번 달을 직접 읽어 만들던 옛 형태가 되살아나면 RED.
    expect(src).not.toMatch(/getMonth\(\)\s*\+\s*1\}월/);
  });

  it("④ 축 계산은 p0-display 한 곳뿐 — route·카드에 로컬 말일 계산 0", () => {
    for (const rel of [ROUTE, "src/components/dashboard/budget-spend-card.tsx"]) {
      const src = read(rel);
      // `new Date(y, m + 1, 0)` = 말일 구하기 관용구. 축을 두 곳에서 세면 또 어긋난다.
      expect(src, `${rel} · 말일 계산이 복제됐다`).not.toMatch(/new Date\([^)]*\+\s*1\s*,\s*0\s*\)/);
    }
  });
});

/** 주어진 창 안에서 `token` 이 포함된 첫 줄. 줄 번호가 아니라 토큰으로 찾는다. */
function lineWith(scope: string, token: string): string {
  const line = scope.split(/\r?\n/).find((l) => l.includes(token));
  expect(line, `${token} 를 포함한 줄이 없다`).toBeTruthy();
  return line!;
}
