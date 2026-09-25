/**
 * §admin-order-create-removed · §funnel-s5-removed (2026-09-25 · 호영님 판정)
 *
 * 호영님: 구매 대행은 나중 일로 보고 **관리자 주문 생성도 지운다.**
 *
 * ── 이걸로 무엇이 0이 되나 ──
 * 견적을 `PURCHASED` 로 옮기는 **UI 경로가 0**이 된다:
 *   일반 사용자  §order-entry-removed 에서 이미 0 (POST /api/orders 호출자 0)
 *   관리자        이 커밋으로 0 (POST /api/admin/orders 호출자 0)
 * → 퍼널 s5(PURCHASED 버킷)는 **생산자가 만들 수 없는 값**이 된다.
 *   생산자가 만들 수 없는 값의 카운트는 표시하지 않는다
 *   (CLAUDE.md §연결되지 않은 소스는 0 을 보여주지 않는다).
 *
 * ── 지우지 않은 것 ──
 * API·DB 는 그대로다: `/api/admin/orders` · `/api/orders` · `Order` · `cancel-restore-quote`.
 * 구매 대행을 시작할 때 다시 쓸 자리다 → docs/plans/QUEUE_concierge-purchasing.md 에
 * **다시 켤 때 필요한 것 셋**을 적어 뒀다.
 *
 * ── 자기 한계 ──
 *   1. `ENABLE_PURCHASING` 플래그 **자체**는 살아 있다. 퍼널에서만 뗐고 소비자 4곳이 남았다:
 *      대시보드 파이프라인 po 단계 · 재무 KPI 「확정 발주액」 · 사이드바 「발주 관리」 · 재고 「바로 발주」.
 *      넷 다 각각 판정이 필요하다 — 특히 「확정 발주액」 은 실제 Order 금액을 읽는 **재무 지표**다.
 *   2. 모바일 뷰의 s5(STAGE_META)는 지우지 않았다 — PURCHASED 행이 생기면 목록에 뜨는
 *      **데이터 표시**이지 약속이 아니다.
 *   3. 소스 문자열만 본다. 런타임은 보지 않는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const APPS_WEB = join(SRC, "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const ADMIN_QUOTES = "app/admin/quotes/page.tsx";
const FUNNEL = "components/quotes/quote-funnel.tsx";
const MOBILE = "components/quotes/mobile-quotes-view.tsx";

describe("§admin-order-create-removed · 관리자 주문 생성 경로 0", () => {
  it("① admin/quotes 가 /api/admin/orders 로 POST 하지 않는다", () => {
    const src = code(ADMIN_QUOTES);
    /* 🛑 이 단언이 이 커밋의 핵심이다 — 되살아나면 PURCHASED 생산자가 다시 생기고
       퍼널 s5 를 지운 근거가 무너진다. 되살릴 때는 이 it 을 함께 은퇴시킨다
       (명제를 이력에 복원한 뒤에 · CLAUDE.md §은퇴시킬 때는 지우기 전에 명제를 복원한다). */
    expect(src).not.toMatch(/api\/admin\/orders/);
    expect(src).not.toMatch(/convertToOrderMutation/);
    // 세 슬롯 전부 — 하나만 지우면 나머지가 남는다(형제 슬롯 전수).
    /* 주의: 「주문 전환」 이라는 **글자**로는 못 잡는다 — 상태 라벨·필터에 같은 글자가 남아 있고
       그건 ② 가 지키는 읽기 축이다. 잡을 것은 글자가 아니라 **배선**이다
       (§"X를 쓰는가" 에 grep 으로 답하지 않는다 — 사용 지점의 형태로 묻는다). */
    expect(src).not.toMatch(/setShowConvertDialog/);
    expect(src).not.toMatch(/주문으로 전환/);
    expect(src).not.toMatch(/canConvert/);
  });

  it("② 읽기 축은 그대로다 (「없는 척」 금지)", () => {
    /* 지운 것은 **만드는 경로**다. 이미 있는 주문을 보는 것까지 없앤 게 아니다.
       PURCHASED 상태 라벨·필터는 남는다 — 관리자가 과거 건을 찾을 수 있어야 한다. */
    const src = code(ADMIN_QUOTES);
    // 상태 맵 항목 **그 자리**를 본다 — 파일 어딘가에 글자가 있는 것으로는 지워진 것을 못 잡는다
    //   (프로브 ② 가 잡았다: 항목을 바꿔도 다른 PURCHASED 가 대신 매칭했다 · 4원칙 ④ 대체 매칭).
    expect(src).toMatch(/PURCHASED:\s+\{\s*label: "주문 전환"/);
    expect(src).toMatch(/<SelectItem value="PURCHASED">주문 전환<\/SelectItem>/);
  });

  it("③ API·DB 는 건드리지 않았다 (구매 대행을 켤 때 다시 쓴다)", () => {
    expect(existsSync(join(SRC, "app/api/admin/orders/route.ts"))).toBe(true);
    expect(existsSync(join(SRC, "app/api/orders/route.ts"))).toBe(true);
    expect(existsSync(join(SRC, "lib/orders/cancel-restore-quote.ts"))).toBe(true);
    // 되살리는 조건이 문서로 남아 있다 — 지우기만 하면 다음 사람이 배선 없이 되살린다.
    expect(
      existsSync(join(APPS_WEB, "docs/plans/QUEUE_concierge-purchasing.md")),
    ).toBe(true);
  });
});

describe("§funnel-s5-removed · 생산자가 없는 단계는 세지 않는다", () => {
  it("④ 퍼널에 s5 단계가 없다", () => {
    const src = code(FUNNEL);
    expect(src).not.toMatch(/key: "s5"/);
    expect(src).not.toMatch(/입고 대기/);
    // s5 를 숨기던 플래그 게이트도 함께 사라진다(가릴 것이 없다).
    expect(src).not.toMatch(/ENABLE_PURCHASING/);
    expect(src).not.toMatch(/getFlag/);
    // 남는 4단계는 그대로다.
    for (const key of ["s1", "s2", "s3", "s4"]) {
      expect(src).toMatch(new RegExp(`key: "${key}"`));
    }
    expect(src).toMatch(/label: "선정 대기"/);
  });

  it("⑤ 모바일 s5 는 남는다 (데이터 표시이지 약속이 아니다)", () => {
    /* 자기 한계 2 — PURCHASED 행이 생기면 목록에 정직하게 떠야 한다.
       퍼널은 「할 일 개수」 라 0이면 거짓이 되고, 목록은 「있는 것」 이라 없으면 숨기는 것이 된다. */
    const src = code(MOBILE);
    expect(src).toMatch(/s5: \{/);
    expect(src).toMatch(/amountLabel: "구매 금액"/);
  });
});
