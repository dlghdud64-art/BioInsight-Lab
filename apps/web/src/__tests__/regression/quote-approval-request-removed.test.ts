/**
 * §quote-approval-request-removed (2026-09-26 · 호영님 판정)
 *
 * **꺼져 있어야 할 결재 경로가 하나 살아 있었다.**
 *
 * ── 실측 (호영님 · 소스 1535행) ──
 * 견적 상세에서 `status === "COMPLETED" && !quote.order && !isAdmin` 이면 「승인 요청」 버튼이 떴고,
 * 누르면 `POST /api/request` 가 `PurchaseRequest` 를 PENDING 으로 만들고
 * 「관리자의 승인을 기다려주세요」 토스트를 띄웠다. 세 가지가 동시에 틀렸다:
 * ```
 * ① 결재 게이트를 거치지 않는다   canRequestApproval 을 부르지 않는다.
 *                                prod capability = enabled:false · policy_not_enabled 인데 이 경로만 열려 있었다
 * ② 승인할 사람이 볼 수 없다      승인 화면은 /admin/requests 하나뿐이고 거기는 **플랫폼 관리자 전용**이다
 *                                (고객사 관리자는 대시보드로 돌려보내진다)
 * ③ 순서가 거꾸로다              COMPLETED 는 「구매 처리」 로 이미 구매가 기록되고 예산이 차감된 상태다.
 *                                그 뒤에 승인을 요청하는 흐름이었다
 * ```
 * prod 실측(operator-shell → Supabase xhid… Session Pooler · SELECT 만 · 2026-09-26):
 *   `PurchaseRequest` **총 0건 · PENDING 0건** → 아무도 볼 수 없는 곳에서 기다린 고객은 없다.
 *
 * ── 처방 ──
 *   1. 버튼·다이얼로그·mutation 삭제(딸린 상태 3개 포함)
 *   2. `POST /api/request` 에 **같은** canRequestApproval 게이트 — 라우트는 지우지 않는다.
 *      재입고 요청 쪽과 `PurchaseRequest` 모델을 공유하므로 **막기만** 한다.
 *   3. 같은 파일의 결재 단어 2곳을 참인 이름으로
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 견적 상세에서 `/api/request` POST 호출 0 (호영님 지정)
 *   ② 라우트가 capability 게이트를 거친다 — 호출자가 0이어도 스스로 막는다 (호영님 지정)
 *   ③ 결재 단어 2곳이 참인 이름이다
 *   ④ 회귀 0 — 라우트·모델은 살아 있다(재입고 요청이 쓴다)
 *
 * ── 자기 한계 ──
 *   1. 정적 검사다. 게이트가 **런타임에** 400 을 내는지는 보지 않는다 —
 *      그건 capability 가 false 인 prod 에서 릴레이가 재는 축이다.
 *   ~~2. 게이트가 재입고 요청도 막을 수 있다~~ → **실측으로 아니다.**
 *      `POST /api/request` 호출자 전수 = **0** (이 커밋이 유일한 호출자를 지웠다).
 *      재입고 요청은 **다른 라우트**다 — `api/inventory/[id]/restock-request` 가 `PurchaseRequest` 를
 *      직접 만든다 → 이 게이트에 걸리지 않는다.
 *      호영님이 말한 「공유」 는 **모델** 공유이지 라우트 공유가 아니었다.
 *      ⚠️ 그 라우트에는 capability 게이트가 없다. 재입고 승인이 결재 축인지는 **별도 판정**이다 —
 *         이 파일은 그 축을 보지 않고, 막지도 않았다.
 *   3. 「승인」 이라는 단어는 결재 이력·상태 라벨에 정당하게 남아 있을 수 있다. 금지 범위를 넓히지 않는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const DETAIL = "app/quotes/[id]/page.tsx";
const ROUTE = "app/api/request/route.ts";

describe("§quote-approval-request-removed · 견적 상세의 결재 경로가 없다", () => {
  it("① /api/request POST 호출이 0 이다 (호영님 지정)", () => {
    const src = code(DETAIL);
    expect(src).not.toMatch(/api\/request/);
    expect(src).not.toMatch(/purchaseRequestMutation/);
    // 버튼·다이얼로그·딸린 상태 — 하나라도 남으면 다음 사람이 배선을 되살린다.
    expect(src).not.toMatch(/승인 요청/);
    expect(src).not.toMatch(/showRequestDialog/);
    expect(src).not.toMatch(/requestMessage/);
    expect(src).not.toMatch(/selectedTeamId/);
    expect(src).not.toMatch(/관리자의 승인을 기다려주세요/);
  });

  it("② 구매 처리 경로는 그대로다 (「없는 척」 이 아니다)", () => {
    /* 지운 것은 **결재 요청**이다. COMPLETED 자리의 살아 있는 안내·구매 경로는 손대지 않았다. */
    const src = code(DETAIL);
    expect(src).toMatch(/구매 처리/);
    expect(src).toMatch(/onClick={handleMarkAsCompleted}/);
    expect(src).toMatch(/입고 관리로/);
  });
});

describe("§quote-approval-request-removed · 라우트가 스스로 막는다", () => {
  it("③ capability 게이트가 enforcement 직후에 온다 (호영님 지정)", () => {
    const src = code(ROUTE);
    expect(src).toMatch(/resolveApprovalCapability\(session\.user\.id\)/);
    expect(src).toMatch(/if \(!capability\.enabled\)/);
    // 400 + 사유 + 공용 문구 — 사유와 문구가 갈리지 않게 같은 모듈에서 온다.
    expect(src).toMatch(/error: "APPROVAL_NOT_AVAILABLE"/);
    expect(src).toMatch(/APPROVAL_BLOCK_MESSAGE\[capability\.reason\]/);
    /* 🔑 raw NextResponse 가 아니라 enforcement.reject() 다 — §audit-reject-raw-4xx 래칫이
       enforceAction 이후의 raw 4xx 수를 상한으로 잡는다(이 커밋이 처음 400 을 넣을 때 래칫이 꺼졌고,
       reject() 로 바꿔 즉시 되살렸다 · CLAUDE.md §래칫류는 기준선 RED 원장에 올리지 않는다). */
    expect(src).toMatch(/return enforcement\.reject\(400, {/);
    expect(src).not.toMatch(/enforcement\.fail\(\)[\s\S]{0,200}NextResponse\.json/);
    /* 🔑 순서를 본다 — 게이트가 생성 코드 **뒤**에 오면 이미 만든 뒤에 막는 것이 된다.
       enforcement 판정 뒤, DB 쓰기 전이어야 한다. */
    const gateAt = src.indexOf("if (!capability.enabled)");
    const createAt = src.indexOf("purchaseRequest.create");
    expect(gateAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(createAt);
  });

  it("④ 회귀 0 · 라우트와 모델은 살아 있다", () => {
    /* 재입고 요청 쪽과 PurchaseRequest 모델을 공유하므로 지우지 않았다(호영님). */
    const src = read(ROUTE);
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/purchaseRequest\.create/);
    // 판정 함수는 §approval-gate-single-source 와 **같은 것**이다 — 사본을 두지 않았다.
    expect(src).toMatch(/from "@\/lib\/approval\/approval-capability\.server"/);
  });
});

describe("§quote-approval-request-removed · 결재 단어 2곳", () => {
  it("⑤ 회원사 다음 액션과 KPI 라벨이 참인 이름이다", () => {
    const src = code(DETAIL);
    // 회원사가 RESPONDED 에서 하는 일은 결재가 아니라 구매 처리다.
    expect(src).not.toMatch(/승인 결정 필요/);
    expect(src).toMatch(/isAdmin \? "비교 검토 필요" : "비교 후 구매 처리"/);
    /* KPI 칸의 조건은 status === "RESPONDED" 일 뿐이고 결재와 무관하다 —
       그 조건이 그대로임을 함께 단언한다(라벨만 바꾸고 조건이 바뀌면 다른 결함이다). */
    expect(src).not.toMatch(/tracking-wider">승인 필요</);
    expect(src).toMatch(/tracking-wider">선정 필요</);
    expect(src).toMatch(/const needsApproval = quoteStatus === "RESPONDED"/);
  });
});
