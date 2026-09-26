/**
 * §purchase-cta-honesty (2026-09-26 · 호영님 판정)
 *
 * **돈이 움직이는 버튼은 이름이 그 동작이어야 하고, 누르기 전에 무엇이 움직이는지 보여야 한다.**
 *
 * ── 실측 ──
 * 견적 상세의 구매 확정 다이얼로그를 여는 버튼이 **둘**이었다:
 * ```
 * 관리자 축  isAdmin && status ∉ {COMPLETED, CANCELLED} && 회신 > 0 → 「구매 진행 처리」
 * 회원사 축  !isAdmin && status === "RESPONDED"                    → 「승인」   🛑
 * ```
 * 둘 다 `handleMarkAsCompleted` 를 부른다 — **같은 다이얼로그**다.
 * 확정하면 `PATCH /api/quotes/[id]` status COMPLETED → `markQuoteAsPurchased` →
 * **PurchaseRecord 생성 + 예산 차감**이 일어난다.
 *
 * 즉 「승인」 은 이름은 결재를 말하고 동작은 구매였다. 게다가 「승인」 은 지금
 * **모든 사용자에게 꺼져 있는 결재 축**의 단어라 §approval-gate-single-source
 * (결재 약속 표면) 조항에도 걸린다(호영님).
 *
 * ── 처방 ──
 *   1. 라벨을 「구매 처리」 로 — 관리자 축 「구매 진행 처리」 와 같은 말
 *   2. 다이얼로그가 **예산 이름과 차감 금액**을 문장으로 말한다
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 이 다이얼로그를 여는 버튼 라벨에 「승인」 이 없다 (호영님 지정 역계약)
 *   ② 두 버튼이 같은 핸들러를 쓴다 — 이름만 맞추고 경로를 가르지 않았다
 *   ③ 다이얼로그가 예산 이름·차감 금액을 말한다 · 금액은 화면 다른 자리와 **같은 변수**다
 *   ④ 회귀 0 — 구매 기록 경로(markQuoteAsPurchased)는 그대로다
 *
 * ── 자기 한계 ──
 *   1. 정적 검사다. 버튼이 실제로 그 다이얼로그를 여는지는 **핸들러 이름의 일치**로 본다.
 *      핸들러가 하는 일이 바뀌면 이 검사는 그것을 모른다.
 *   2. 「승인」 이라는 단어는 이 화면의 **다른 자리**(결재 이력·상태 라벨)에는 남아 있을 수 있다.
 *      금지 범위는 **이 다이얼로그를 여는 버튼**으로 한정한다 — 넓히면 오탐이 난다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const DETAIL = "app/quotes/[id]/page.tsx";
const code = () => stripComments(readFileSync(join(SRC, DETAIL), "utf8"));

/** 구매 다이얼로그를 여는 버튼의 창 — 여는 태그부터 닫는 태그까지(4원칙 ②). */
function openerBlocks(src: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const hit = src.indexOf("onClick={handleMarkAsCompleted}", from);
    if (hit < 0) break;
    const start = src.lastIndexOf("<Button", hit);
    const end = src.indexOf("</Button>", hit);
    expect(start, "여는 태그 부재").toBeGreaterThan(-1);
    expect(end, "닫는 태그 부재").toBeGreaterThan(-1);
    out.push(src.slice(start, end));
    from = end;
  }
  return out;
}

describe("§purchase-cta-honesty · 구매 버튼은 구매라고 말한다", () => {
  it("① 다이얼로그를 여는 버튼 라벨에 「승인」 이 없다 (호영님 지정)", () => {
    const blocks = openerBlocks(code());
    // 두 자리(관리자 축 · 회원사 축) 모두 잡혔는지 먼저 확인한다 — 하나만 보면 나머지가 남는다.
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b, "구매 다이얼로그를 여는 버튼에 「승인」").not.toMatch(/승인/);
      expect(b).toMatch(/구매/);
    }
  });

  it("② 두 버튼이 같은 핸들러를 쓴다 (이름만 맞추고 경로를 가르지 않았다)", () => {
    const src = code();
    const calls = src.match(/onClick=\{handleMarkAsCompleted\}/g);
    expect(calls ?? []).toHaveLength(2);
    // 회원사 축 라벨이 관리자 축과 같은 말인지.
    expect(src).toMatch(/구매 처리/);
    expect(src).toMatch(/구매 진행 처리/);
  });

  it("③ 다이얼로그가 예산 이름과 차감 금액을 말한다", () => {
    const src = code();
    expect(src).toMatch(/이 견적을 구매한 것으로 기록합니다/);
    expect(src).toMatch(/에서 ₩\$\{purchaseTotal\.toLocaleString\("ko-KR"\)\}이 차감됩니다/);
    /* 🔑 금액은 화면 다른 자리(차감 금액)와 **같은 변수**를 쓴다 —
       다른 식으로 계산하면 같은 화면이 두 숫자를 말한다
       (§화면이 보여주는 수와 게이트가 판정하는 수는 같은 함수에서). */
    expect(src).toMatch(/purchaseTotal\.toLocaleString\("ko-KR"\)/);
    // 예산을 고르기 전에는 고르라고만 한다 — 없는 이름·금액을 적지 않는다.
    expect(src).toMatch(/차감할 예산을 선택하세요/);
  });

  it("④ 회귀 0 · 구매 기록 경로는 그대로다", () => {
    const src = code();
    expect(src).toMatch(/status: "COMPLETED", budgetId: purchaseBudgetId/);
    const route = readFileSync(join(SRC, "app/api/quotes/[id]/route.ts"), "utf8");
    expect(route).toMatch(/markQuoteAsPurchased\(\{/);
  });
});
