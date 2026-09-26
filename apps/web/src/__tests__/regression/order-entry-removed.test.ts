/**
 * §order-entry-removed (2026-09-25 · 호영님 판정) ·
 * **견적 화면이 만들 수 없는 다음 단계를 약속하지 않는다.**
 *
 * ── 왜 ──
 * 견적 두 화면에 「주문 접수」가 있었다. `POST /api/orders` 로 Order 를 만들고
 * 성공 토스트가 「주문이 접수되었습니다 · **주문 내역에서 확인하세요**」 였는데,
 * 그 주문 내역 화면이 없다 — §po-ui-removed · §purchases-ui-removed 로 지웠다.
 * prod 주문 2건이 이 경로로 생겼고, 그 2건을 **볼 화면이 지금 제품에 없다.**
 *
 * ── 결재로 바꾸지 않은 이유 (prod 실측 2026-09-25 · 읽기 전용 SELECT · ref xhid…dhsw) ──
 *   Workspace 1개 · plan="FREE" · stripePriceId=null
 *     → resolveApprovalPolicyForPlan("FREE") = "none"
 *     → request-approval 라우트가 400 APPROVAL_POLICY_NOT_ENABLED
 *   OrganizationMember 역할 = OWNER 1명 · **ADMIN 0**
 *     → 요금제를 올려도 「결재자 미설정」 으로 두 번째 400
 *   🛑 정책 출처는 **조직 설정이 아니라 워크스페이스 요금제**다.
 *      `Organization` 에는 approvalPolicy 필드 자체가 없다(Prisma 필드 목록 실측).
 *   🛑 요금제 안내조차 오늘은 참이 아니다 — §유료 결제 오픈 전 게이트가 닫혀 있어
 *      결제해도 webhook 이 plan="TEAM" 만 써서 in_app_approval 에 닿지 않는다.
 *      **켜지지 않는 경로를 가리키는 문장은 쓰지 않는다**(호영님).
 *
 * ── 그래서 쓴 것 ──
 * 오늘 사용자가 실제로 하는 일을 그대로 적었다 — 선정하고, 플랫폼 밖에서 사고, 입고로 돌아온다.
 *   「선정 완료 · 구매 후 입고 관리에서 입고를 등록하세요」
 * 탭 이름은 「결재 요청」이 아니라 **「다음 단계」** 다. FREE 에서는 결재가 없는데
 * 탭 이름이 결재를 약속하면 안 된다(호영님).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 견적 두 화면에서 `POST /api/orders` 호출 0 (역계약)
 *   ② 「주문 접수」·「발주 준비」·「발주 전환」 문구 0 (역계약 · 주석 제외)
 *   ③ 전환 자리가 오늘 참인 것을 말한다 — 선정 완료 · 입고 등록
 *   ④ 결재 버튼을 붙이지 않았다 — approvalPolicy 확인 없이 렌더되는 결재 CTA 0
 *   ⑤ API·DB 무변경 — /api/orders 와 request-approval 라우트는 그대로다
 *
 * ── 자기 한계 ──
 *   1. `/api/work-queue/purchase-conversion/bulk-po` 의 에러 문구에 「일괄 발주 전환」 이 남아 있다.
 *      호출자가 0(구매 운영 삭제)이라 사용자에게 보이지 않는다. API 무변경 지시 범위라 두었다.
 *   2. `api/pricing-assistant` 의 시스템 프롬프트가 제품 기능으로 「발주 준비」 를 말한다.
 *      LLM 에게 주는 제품 설명이라 사용자 문구 축과 다르다 — 「결재·발주 약속 표면 전수」 큐 대상.
 *   3. 소스 문자열만 본다. 렌더 결과는 보지 않는다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const LIST = "app/dashboard/quotes/page.tsx";
const DETAIL = "app/quotes/[id]/page.tsx";
const SURFACES = [LIST, DETAIL] as const;

describe("§order-entry-removed · 만들 수 없는 다음 단계를 약속하지 않는다", () => {
  it("① 견적 두 화면에서 POST /api/orders 호출 0 (역계약)", () => {
    /* 🛑 경로를 각각 단언한다 — 한쪽만 끊기면 나머지가 계속 볼 수 없는 주문을 만든다
     *    (CLAUDE.md: 전파 경로는 OR 로 묶지 말고 각각 단언한다). */
    for (const rel of SURFACES) {
      const src = code(rel);
      expect(src, `${rel}: /api/orders 호출 잔존`).not.toMatch(/["'`]\/api\/orders["'`]/);
      expect(src, `${rel}: 주문 생성 mutation 잔존`).not.toMatch(/createOrderMutation|submitOrder/);
    }
  });

  it("② 「주문 접수」·「발주 준비」·「발주 전환」 문구 0 (주석 제외)", () => {
    for (const rel of SURFACES) {
      const src = code(rel);
      for (const banned of ["주문 접수", "발주 준비", "발주 전환", "주문 내역에서 확인"]) {
        expect(src, `${rel}: 「${banned}」 잔존`).not.toContain(banned);
      }
    }
  });

  it("③ 전환 자리가 오늘 참인 것을 말한다 (선정 완료 · 입고 등록)", () => {
    const list = code(LIST);
    /* 승계 §quote-selection-recorded (2026-09-25 · 호영님 판정) — 「선정 완료」 는 **조건부로** 참이다(selectedReplyId 존재 시).
       기록이 없는 오늘의 prod 에서는 「회신 도착 · 비교 후 선정」 이 뜬다. 두 문구가 **둘 다** 있어야
       전환 자리가 두 경우를 모두 말하는 것이다. 명제(전환 자리가 오늘 참인 것을 말한다)는 불변. */
    expect(list).toContain("선정 완료");
    expect(list).toContain("회신 도착 · 비교 후 선정");
    expect(list).toContain("구매 후 입고 관리에서 입고를 등록하세요");
    /* 승계 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 구 단언 「레일 탭 이름 `다음 단계`」 는 레일과 함께 은퇴.
       탭이 없어졌으므로 결재를 약속하는 라벨이 없다는 역단언만 남긴다. */
    expect(list).not.toMatch(/label: "결재 요청"/);

    const detail = code(DETAIL);
    expect(detail).toContain("선정 완료");
    expect(detail).toContain("회신 도착 · 비교 후 선정");
    expect(detail).toContain("구매 후 입고 관리에서 입고를 등록하세요");
    expect(detail).toMatch(/href="\/dashboard\/receiving"/);
  });

  it("④ 결재 CTA 를 붙이지 않았다 (요금제로 막히는 버튼 0)", () => {
    /* prod FREE → approvalPolicy "none" → 400. ADMIN 0 → 두 번째 400.
     * 두 번 막히는 버튼은 만들지 않는다. 나중에 붙일 때는 정책 확인이 **함께** 와야 한다. */
    for (const rel of SURFACES) {
      const src = code(rel);
      expect(src, `${rel}: request-approval 호출`).not.toContain("request-approval");
      // 요금제로 켜지지 않는 경로를 가리키는 안내도 두지 않았다
      expect(src, `${rel}: 요금제 안내`).not.toMatch(/R&D Operations 이상|결재는 .*요금제/);
    }
  });

  it("⑤ API·DB 는 무변경 · 지운 것은 화면뿐이다", () => {
    for (const rel of [
      "app/api/orders/route.ts",
      "app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts",
    ]) {
      expect(existsSync(join(SRC, rel)), `${rel}: API 는 유지`).toBe(true);
    }
    // 결재 라우트의 서버 teamId 검증은 그대로 산다 — 진입점이 생기면 그대로 쓴다
    const route = code("app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts");
    expect(route).toContain("APPROVAL_POLICY_NOT_ENABLED");
    expect(route).toMatch(/\bteamId\b/);
  });
});
