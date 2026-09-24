/**
 * §quote-approval-team (2026-09-22 · 호영님 판정 (가)안) · **견적→결재 전환이 팀 귀속을 채운다.**
 *
 * ── 왜 ──
 * 「팀별 보기」 탭이 비어 있던 진짜 원인이다(§team-view-no-fabrication 에서 지목).
 * 지출 원장에는 팀 필드가 없고, 팀으로 가는 경로는 `PurchaseRequest.teamId → orderId → Order` 하나뿐인데
 * **그 PurchaseRequest 를 만드는 유일한 생성 지점**(견적→결재 전환)이 teamId 를 채우지 않았다.
 * 팀을 만들고 예산을 배정해도 이 경로로 발주하면 팀 집계는 영원히 0 이었다.
 *
 * ── 왜 (가)안인가 (호영님) ──
 * (나)안(소속 팀이 하나면 서버가 자동 충전)은 채택하지 않았다:
 *   · 사용자가 두 번째 팀에 들어가는 순간 귀속이 **조용히** 바뀐다. 아무도 아무것도 안 했는데 집계가 달라지고,
 *     그 원인이 화면 어디에도 보이지 않는다.
 *   · 「이 건은 다른 팀 것」 을 표현할 방법이 없다.
 * (가)안은 `/api/request` 와 같은 규칙이라 경로가 둘로 갈리지 않는다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 전달된 teamId 만 채운다 — 서버의 조용한 추측 0
 *   ② 서버가 두 가지를 **따로** 세운다 — 팀 멤버십 · 팀↔결재 조직 일치(귀속 정확 != 행위 허용)
 *   ③ UI 가 팀 선택을 노출한다 — 소속 팀이 하나여도 **숨기지 않는다**(채워진 값이 보여야 고칠 수 있다)
 *   ④ 팀이 없으면 그 사실을 말한다 — 조직으로만 귀속
 *
 * ── 자기 한계 ──
 *   1. prod 는 Team 0 · PurchaseRequest 0 이라 오늘 이 경로로 채워질 팀이 없다(2026-09-13 실측).
 *      배선이 참인지는 팀이 생긴 뒤 실데이터로 다시 잰다.
 *   2. 발주(Order) 로 이어지는 뒷단(teamId → orderId)은 이 파일의 범위 밖이다.
 *   3. 다른 생성 경로(`/api/request`)는 이미 teamId 를 필수로 받는다 — 무변경.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const ROUTE = "app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";
const UI = "app/dashboard/purchases/page.tsx";

/** PR 생성 payload 블록 — 창은 블록 경계로(고정 폭 금지 · 4원칙 ⑤) */
function createBlock(): string {
  const src = code(ROUTE);
  const start = src.indexOf("db.purchaseRequest.create({");
  const end = src.indexOf("select: {", start);
  return start < 0 || end < 0 ? "" : src.slice(start, end);
}

describe("§quote-approval-team · 견적→결재가 팀 귀속을 채운다", () => {
  it("① 전달된 teamId 만 채운다 (서버의 조용한 추측 0)", () => {
    const src = code(ROUTE);
    expect(src).toMatch(/const body = \(await request\.json\(\)\.catch/);
    expect(src).toMatch(/typeof body\.teamId === "string"/);
    const block = createBlock();
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/\bteamId,/);
    // 소속 팀 1개를 서버가 자동으로 고르는 형태(나안)가 들어오면 RED
    expect(src).not.toMatch(/teamMember\.findFirst/);
    expect(src).not.toMatch(/teams\[0\]/);
  });

  it("② 멤버십과 조직 일치를 따로 세운다", () => {
    const src = code(ROUTE);
    // 팀 → 조직 일치
    expect(src).toMatch(/db\.team\.findUnique\(\{[\s\S]{0,120}?select: \{ organizationId: true \}/);
    expect(src).toMatch(/team\.organizationId !== orgId/);
    expect(src).toMatch(/"TEAM_ORG_MISMATCH"/);
    // 요청자 → 팀 멤버십
    expect(src).toMatch(/db\.teamMember\.findUnique\(\{[\s\S]{0,140}?userId_teamId/);
    expect(src).toMatch(/"TEAM_FORBIDDEN"/);
    /* 🛑 문자열만 물으면 가드를 무력화해도 통과한다 — 프로브 T3 실측:
     *    `if (false && !teamMembership)` 로 바꿔도 findUnique·TEAM_FORBIDDEN 이 그대로라 GREEN 이었다.
     *    조회 결과가 **그대로 분기 조건**인지를 묻는다(두 가드 모두). */
    expect(src).toMatch(/\n\s*if \(!teamMembership\) \{/);
    expect(src).toMatch(/\n\s*if \(team\.organizationId !== orgId\) \{/);
    // 두 단언이 서로를 대신하지 않는다 — 각각의 실패 코드가 따로 있다(④ 대체 매칭 방지)
    expect(src.indexOf("TEAM_ORG_MISMATCH")).not.toBe(src.indexOf("TEAM_FORBIDDEN"));
  });

  /* 🛑 은퇴 §purchases-ui-removed (2026-09-24 · 호영님 판정) — ③④(UI 축). 사유 = **진입점 이전 예정**(소멸 아님 · 호영님 ① 판정).
   *
   *    이 UI 는 삭제된 구매 운영 화면에 있었다. 그 화면이 `request-approval` 의 유일한 호출자였으므로
   *    삭제로 결재 요청 생성 경로가 0 이 된다. 호영님 판정: **결재는 버리지 않는다** —
   *    CTA 를 견적 상세로 옮기고 teamId 지시를 거기서 구현한다.
   *
   *    명제 원문(옮길 때 그대로 다시 든다):
   *      ③ 팀 선택을 노출한다 · 소속 팀이 하나여도 숨기지 않는다(myTeams.length > 0 렌더 ·
   *        1개면 기본 선택) · 전달은 명시적이다(teamId 있을 때만 본문에 넣는다)
   *      ④ 팀이 없으면 그 사실을 말한다(「소속된 팀이 없어 조직으로만 귀속됩니다」)
   *
   *    🔑 ①②(서버 검증)는 **유지**한다 — `request-approval` 라우트는 살아 있고,
   *       새 CTA 의 teamId 검증 기반이 그대로 그것이다(호영님 ④ 판정). */
});
