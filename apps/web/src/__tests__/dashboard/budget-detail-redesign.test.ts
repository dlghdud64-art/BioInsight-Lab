/**
 * §budget-detail-redesign — 예산 상세 재구성 (호영님 핸드오프 2026-09-25)
 *
 * 정본: 예산 상세 핸드오프.md · 예산 상세 리디자인 (단독).html
 *
 * 명제
 *   A. 판정은 서버가 한다 — 사용률·상태·예상 소진일은 deriveBudgetDetail 한 곳에서 나온다(행동 단언).
 *   B. 사용액 = 활성 예약 + 집행. 구 화면의 `reserved = 0` 상수는 없다.
 *   C. 상태 톤은 대시보드와 같은 함수(budTone)다 · 경고 경계 상수가 budTone 경계와 같다.
 *   D. 연결되지 않은 소스(확정·조정 이력·소유자·부서·편차·승인·카테고리)는 0 으로도 그리지 않는다.
 *      무엇이 연결되지 않았는지는 문구로 밝힌다.
 *   E. 헤더에 삭제 버튼 직접 노출 0 · ⋮ 안에 있다 · 활성 예약이 있으면 서버가 409 로 거절한다.
 *   F. 영문 enum·em dash·amber 토큰이 화면에 없다.
 *
 * 🛑 §comment-axis — 존재 단언은 주석 제거본으로 한다.
 * 자기 한계: E 의 409 는 정적 단언이다(라우트 실행 아님). A~C 만 행동 단언이다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "../_helpers/em-dash-scan";
import { blockFrom } from "../_helpers/block-window";
import {
  deriveBudgetDetail,
  seoulToday,
  BUDGET_WARN_RATE,
  BUDGET_BLOCK_RATE,
} from "@/lib/budget/budget-detail-derive";
import { budTone } from "@/lib/dashboard/summary-derive";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = "src/app/dashboard/budget/[id]/page.tsx";
const API = "src/app/api/budgets/[id]/route.ts";
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));
/** 핸들러 **본문** 창 · 시그니처의 `{ params }` 가 아니라 `) {` 뒤 중괄호 짝으로 연다(4원칙 ②⑤). */
const handlerBody = (src: string, marker: string) => {
  const i = src.indexOf(marker);
  if (i < 0) return "";
  return blockFrom(src, src.indexOf(") {", i) + 2);
};

const base = {
  amount: 8_000_000,
  startDate: "2026-10-01",
  endDate: "2026-12-31",
};

describe("A · 서버 판정 (행동)", () => {
  it("시안 1b 수치를 재현한다 · 사용 73% · 가용 ₩2,140,000 · 경고까지 ₩540,000", () => {
    // 시안: 예약 1,260,000 + 확정 1,850,000 + 집행 2,750,000 = 5,860,000.
    // 이 저장소에는 확정 단계가 없으므로 예약에 합쳐 넣는다(총 사용액은 같다).
    const c = deriveBudgetDetail({ ...base, reserved: 3_110_000, actual: 2_750_000, today: { y: 2026, m: 11, d: 10 } });
    expect(c.used).toBe(5_860_000);
    expect(c.available).toBe(2_140_000);
    expect(c.usedRate).toBe(73.3);
    expect(c.status).toBe("normal");
    expect(c.nearWarn).toBe(true);
    expect(c.warnAmountLeft).toBe(540_000);
    expect(c.elapsedDays).toBe(41);
    expect(c.totalDays).toBe(92);
    expect(c.phase).toBe("active");
  });

  it("진도 예측 · 경과일 기준 선형 · 종료 전 소진이면 앞선 일수를 준다", () => {
    const c = deriveBudgetDetail({ ...base, reserved: 3_110_000, actual: 2_750_000, today: { y: 2026, m: 11, d: 10 } });
    // 일평균 = floor(5,860,000 / 41) = 142,926 · 가용 2,140,000 / 142,926 → 15일 뒤 = 11. 25.
    expect(c.dailyBurn).toBe(142_926);
    expect(c.projectedExhaustDate).toBe("2026-11-25");
    expect(c.exhaustBeforeEnd).toBe(true);
    expect(c.daysBeforeEnd).toBe(36);
  });

  it("초기 상태(사용 0) · 예측 없음 · 일평균 여유 = 가용 / 남은 일수(오늘 포함)", () => {
    const c = deriveBudgetDetail({
      amount: 10_000_000,
      reserved: 0,
      actual: 0,
      startDate: "2026-09-20",
      endDate: "2026-12-30",
      today: { y: 2026, m: 9, d: 22 },
    });
    expect(c.usedRate).toBe(0);
    expect(c.status).toBe("normal");
    expect(c.projectedExhaustDate).toBeNull();
    expect(c.elapsedDays).toBe(3);
    expect(c.totalDays).toBe(102);
    expect(c.daysLeft).toBe(100);
    expect(c.dailyHeadroom).toBe(100_000);
    expect(c.warnAmountLeft).toBe(8_000_000);
  });

  it("기간 밖 · 시작 전과 종료 후를 가른다", () => {
    const before = deriveBudgetDetail({ ...base, reserved: 0, actual: 0, today: { y: 2026, m: 9, d: 1 } });
    expect(before.phase).toBe("upcoming");
    expect(before.elapsedDays).toBe(0);
    const after = deriveBudgetDetail({ ...base, reserved: 0, actual: 100, today: { y: 2027, m: 1, d: 2 } });
    expect(after.phase).toBe("ended");
    expect(after.elapsedDays).toBe(92);
    expect(after.projectedExhaustDate).toBeNull();
  });

  it("KST 달력 · 서버가 UTC 여도 한국 날짜로 센다", () => {
    // 2026-09-24T16:30Z = 2026-09-25 01:30 KST
    expect(seoulToday(new Date("2026-09-24T16:30:00Z"))).toEqual({ y: 2026, m: 9, d: 25 });
  });
});

describe("B · 사용액 = 예약 + 집행", () => {
  it("예약만 있어도 사용률이 오른다(구 화면은 예약을 상수 0 으로 뒀다)", () => {
    const c = deriveBudgetDetail({ ...base, reserved: 6_400_000, actual: 0, today: { y: 2026, m: 11, d: 1 } });
    expect(c.usedRate).toBe(80);
    expect(c.status).toBe("warning");
  });

  it("API 는 예약을 BudgetEvent 원장에서 · 발주 판정과 같은 함수로 센다", () => {
    const get = handlerBody(code(API), "export async function GET");
    expect(get).toMatch(/db\.budgetEvent\.findMany\(/);
    expect(get).toMatch(/const reserved = activeReservedAmount\(orderEvents\)/);
    expect(get).toMatch(/deriveBudgetDetail\(\{[\s\S]*?reserved,[\s\S]*?actual: totalSpent/);
    expect(code(PAGE)).not.toMatch(/reserved\s*=\s*0/);
  });
});

describe("C · 상태 톤은 대시보드와 같은 함수", () => {
  it("경고 경계 상수가 budTone 경계와 같다", () => {
    expect(budTone(true, BUDGET_WARN_RATE - 0.1)).toBe("ok");
    expect(budTone(true, BUDGET_WARN_RATE)).toBe("warn");
    expect(budTone(true, BUDGET_BLOCK_RATE - 0.1)).toBe("warn");
    expect(budTone(true, BUDGET_BLOCK_RATE)).toBe("danger");
  });

  it("상태 3종 리터럴 · 화면 pill 은 서버 status 만 읽는다", () => {
    const at = (rate: number) =>
      deriveBudgetDetail({ ...base, reserved: 0, actual: (base.amount * rate) / 100, today: { y: 2026, m: 11, d: 1 } }).status;
    expect([at(10), at(85), at(100)]).toEqual(["normal", "warning", "blocked"]);
    const page = code(PAGE);
    expect(page).toMatch(/ctrl\.status === "blocked"/);
    expect(page).not.toMatch(/usedRate\s*>=|burnRate/);
  });
});

describe("D · 연결되지 않은 소스는 그리지 않는다", () => {
  const page = () => code(PAGE);
  it("확정 단계·조정 이력·소유자·부서·편차·통화 행 0", () => {
    const src = page();
    for (const word of ["확정", "조정 이력", "소유자", "부서", "편차 허용", "통화", "예산 영향 이력", "통제 상태"]) {
      expect(src, `연결되지 않은 「${word}」 가 화면에 있다`).not.toContain(word);
    }
  });
  it("연결되지 않은 규칙은 문구로 밝힌다(침묵이 아니라 거짓 0 의 제거)", () => {
    expect(page()).toContain("승인·카테고리 한도는 아직 이 예산 규칙에 연결되지 않았습니다.");
  });
  it("단계 필터 알약은 두 단계에 모두 항목이 있을 때만 · 옵션 1개면 컨트롤 0", () => {
    expect(page()).toMatch(/const showStageChips = ledger\.reservedCount > 0 && ledger\.actualCount > 0/);
    expect(page()).toMatch(/\{showStageChips && \(/);
  });
  it("원시 description 을 내리지 않는다 · 사용자 설명(note)만", () => {
    const get = handlerBody(code(API), "export async function GET");
    expect(get).toMatch(/description: undefined/);
    expect(get).toMatch(/\bnote,/);
    expect(page()).not.toMatch(/budget\.description/);
  });
  it("가짜 데이터 상수 0 (MOCK_LINKED_ACTIVITIES · DEFAULT_POLICY)", () => {
    expect(page()).not.toMatch(/MOCK_|DEFAULT_POLICY/);
  });
});

describe("E · 삭제 동선", () => {
  it("헤더 직접 노출 0 · ⋮(Popover) 안에 있다", () => {
    const src = page();
    const pop = src.slice(src.indexOf("<PopoverContent"), src.indexOf("</PopoverContent>"));
    expect(pop).toMatch(/onClick=\{\(\) => setDeleteOpen\(true\)\}/);
    expect(src.split("setDeleteOpen(true)").length - 1, "⋮ 밖에 삭제 진입점이 또 있다").toBe(1);
  });
  it("활성 예약이 있으면 서버가 409 로 거절 · 화면도 같은 조건으로 막고 사유를 보인다", () => {
    const del = handlerBody(code(API), "export async function DELETE");
    const guard = del.indexOf("activeReservedAmount(reservationEvents) > 0");
    const remove = del.indexOf("db.budget.delete(");
    expect(guard).toBeGreaterThan(-1);
    expect(guard, "가드가 삭제보다 뒤에 있다").toBeLessThan(remove);
    expect(del).toMatch(/enforcement\.reject\(409/);
    expect(page()).toMatch(/disabled=\{ledger\.reservedCount > 0\}/);
    expect(page()).toMatch(/발주 예약 \{ledger\.reservedCount\}건이 걸려 있어 삭제할 수 없습니다/);
  });
  function page() { return code(PAGE); }
});

describe("F · 화면 문구 규율", () => {
  const files = [PAGE, "src/components/budget/budget-edit-dialog.tsx", "src/components/ui/type-to-confirm-dialog.tsx"];
  it("영문 단계 enum 노출 0", () => {
    const src = code(PAGE);
    expect(src).not.toMatch(/Reserved|Committed|Actual|Available|reserved\/committed\/actual/);
  });
  it("amber·orange 토큰 0 (§11.302)", () => {
    for (const f of files) expect(code(f), f).not.toMatch(/\b(amber|orange)-\d/);
  });
  it("em dash 0 (주석 제외)", () => {
    for (const f of files) expect(code(f), f).not.toContain("—");
  });
});
