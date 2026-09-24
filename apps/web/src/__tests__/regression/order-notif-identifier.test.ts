/**
 * §order-notif-identifier (2026-09-24 · 호영님 P1) ·
 * **주문 알림 제목이 어느 주문인지 말한다.**
 *
 * ── 왜 ──
 * 알림 센터에 「주문 생성」 이 2건 있었는데 제목이 **글자까지 똑같아** 둘을 구분할 수 없었다
 * (호영님 라이브 실측: 「주문 생성 · 30일 전」 · 「주문 생성 · 32일 전」).
 * 재고 알림이 `productName` 을 안 읽어 prod 전량 「… 재고」 로만 보이던 것(§notifications-route)과
 * **같은 형태**다 — 문구 함수가 payload 의 식별자를 읽지 않는다.
 *
 * ── prod 실측 2026-09-24 (읽기 전용 SELECT · ref xhid…dhsw · 대조군 userCount 3 / orgCount 2) ──
 *   NotificationEvent.metadata = { quoteId, orderNumber, totalAmount }              ← 2건 전부
 *   NotificationAction.payload = { label, quoteId, eventType, actionType, orderNumber, totalAmount }
 *   🔑 두 건에서 **갈리는 필드는 `orderNumber` 하나**다 — ORD-20260824-SKSQ · ORD-20260822-C3PN.
 *   🛑 `quoteId` 는 두 건이 **같은 값**(cmsyl7875…)이라 식별자가 되지 못한다.
 *      「payload 에 id 가 있으니 쓰면 된다」 로 고르면 제목이 여전히 안 갈린다.
 *   대표 품목 필드는 payload 에 **없다** — 있는 필드로만 만든다(없는 필드를 가정하지 않는다).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 웹·모바일 둘 다 주문번호 추출기를 가진다 · metadata 를 먼저 보고 payload 로 떨어진다
 *   ② 형제 슬롯 **3개 전부** 식별자를 붙인다 (생성 · 배송 시작 · 배송 완료)
 *   ③ 식별자가 없으면 옛 문구로 떨어진다 (제목이 비거나 「· undefined」 가 되지 않는다)
 *   ④ 🛑 `quoteId` 를 제목 식별자로 쓰지 않는다 (역계약 · 위 실측 근거)
 *   ⑤ 웹 ↔ 모바일 drift 0 — 두 파일이 같은 형태를 가진다
 *   ⑥ 회귀 0 — 재고 계열의 `productNameOf` 배선은 무손상
 *
 * ── 자기 한계 ──
 *   1. 소스 문자열만 본다. 런타임 렌더는 보지 않는다 — prod 화면 확인은 호영님 로그인 축이다.
 *   2. 주문 **상태**(실측 2건 모두 CANCELLED)는 제목에 넣지 않았다. 지시 범위가 「식별자」 였다.
 *      취소된 주문이 「주문 생성」 으로만 보이는 것이 맞는지는 **판정 대기**다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const WEB = "src/lib/notifications/event-category-map.ts";
const MOBILE = "apps/mobile/lib/event-category-map.ts";

const webCode = () => stripComments(readFileSync(join(WEB_ROOT, WEB), "utf8"));
const mobileCode = () => stripComments(readFileSync(join(REPO_ROOT, MOBILE), "utf8"));

/** `buildNotificationText` 본문 — 블록 경계로 연다(고정 폭 슬라이스 금지 · CLAUDE.md 4원칙 ⑤). */
function textFnBody(code: string): string {
  const start = code.indexOf("export function buildNotificationText");
  expect(start, "buildNotificationText 없음").toBeGreaterThan(-1);
  const end = code.indexOf("\nexport function", start + 1);
  return end > start ? code.slice(start, end) : code.slice(start);
}

const SURFACES: Array<[string, () => string]> = [
  ["web", webCode],
  ["mobile", mobileCode],
];

describe("§order-notif-identifier · 주문 알림 제목이 어느 주문인지 말한다", () => {
  it("① 두 표면 모두 주문번호 추출기를 가진다 (metadata → payload 순)", () => {
    for (const [name, get] of SURFACES) {
      const code = get();
      expect(code, `${name}: 추출기 없음`).toMatch(
        /function orderNumberOf\(item: NotificationItem\): string \| null/,
      );
      /* 🛑 두 출처를 **각각** 단언한다 — OR 로 묶으면 한쪽 경로가 끊겨도 통과한다.
       *    (CLAUDE.md: 전파 경로는 OR 로 묶지 말고 각각 단언한다) */
      const body = code.slice(code.indexOf("function orderNumberOf"));
      expect(body, `${name}: metadata 경로`).toMatch(/item\.event\.metadata/);
      expect(body, `${name}: payload 경로`).toMatch(/item\.payload/);
      expect(body, `${name}: metadata 우선`).toMatch(
        /meta\.orderNumber \?\? payload\.orderNumber/,
      );
      // 빈 문자열을 식별자로 쓰지 않는다
      expect(body, `${name}: 공백 가드`).toMatch(/trim\(\)\.length > 0/);
    }
  });

  it("② 형제 슬롯 3개 전부 식별자를 붙인다", () => {
    for (const [name, get] of SURFACES) {
      const body = textFnBody(get());
      for (const [type, label] of [
        ["ORDER_PLACED", "주문 생성"],
        ["ORDER_SHIPPED", "주문 배송 시작"],
        ["ORDER_DELIVERED", "주문 배송 완료"],
      ] as const) {
        const i = body.indexOf(`eventType === "${type}"`);
        expect(i, `${name}/${type}: 분기 없음`).toBeGreaterThan(-1);
        // 창은 그 분기 블록으로 연다 — 다음 분기 시작까지
        const nextIdx = body.indexOf('eventType === "', i + 1);
        const block = nextIdx > i ? body.slice(i, nextIdx) : body.slice(i);
        expect(block, `${name}/${type}: 추출기 미호출`).toMatch(/orderNumberOf\(item\)/);
        expect(block, `${name}/${type}: 식별자 미표시`).toContain(`${label} · \${no}`);
      }
    }
  });

  it("③ 식별자가 없으면 옛 문구로 떨어진다", () => {
    for (const [name, get] of SURFACES) {
      const body = textFnBody(get());
      for (const label of ["주문 생성", "주문 배송 시작", "주문 배송 완료"]) {
        expect(body, `${name}/${label}: fallback 없음`).toContain(`: "${label}"`);
      }
    }
  });

  it("④ quoteId 를 제목 식별자로 쓰지 않는다 (역계약)", () => {
    /* prod 2건이 같은 quoteId 라 제목이 안 갈린다. 「id 가 있으니 쓴다」 로 고치면
     * 증상은 그대로인데 게이트만 GREEN 이 된다. */
    for (const [name, get] of SURFACES) {
      const body = textFnBody(get());
      const start = body.indexOf('eventType === "ORDER_PLACED"');
      const end = body.indexOf('eventType === "COMPARE_COMPLETED"', start);
      const orders = end > start ? body.slice(start, end) : body.slice(start);
      expect(orders, `${name}: 주문 분기에 quoteId`).not.toMatch(/quoteId/);
    }
  });

  it("⑤ 웹 ↔ 모바일 drift 0 (두 파일이 같은 형태)", () => {
    const w = webCode();
    const m = mobileCode();
    for (const token of [
      "function orderNumberOf",
      "meta.orderNumber ?? payload.orderNumber",
      "주문 생성 · ${no}",
      "주문 배송 시작 · ${no}",
      "주문 배송 완료 · ${no}",
    ]) {
      expect(w, `web 에 없음: ${token}`).toContain(token);
      expect(m, `mobile 에 없음: ${token}`).toContain(token);
    }
  });

  it("⑥ 회귀 0 · 재고 계열 productNameOf 배선 무손상", () => {
    for (const [name, get] of SURFACES) {
      const body = textFnBody(get());
      expect(body, `${name}: 재고 부족`).toContain("재고 부족 · ${name}");
      expect(body, `${name}: 유효기한 임박`).toContain("유효기한 임박 · ${name}");
      expect(body, `${name}: 입고 완료`).toContain("입고 완료 · ${name}");
    }
  });
});
