/**
 * §purchase-request-org-axis #실재화 — 유령 참조가 실제 컬럼 위에서 무엇을 하는가
 *   (호영님 지시 2026-08-30 "7곳 실재화 · :546 소생 + 동작 검증")
 *
 * 카드: docs/handoff/CARD_approver-axis-splits-in-one-screen.md
 *
 * 🛑 계수 정정 — 세 번 움직였다. **축과 시점을 함께 적는다**(§2b 사례 1·2·3).
 *
 *     7곳   직접 6 + team 경유 1(`:156`)  ... 단위가 섞였다
 *     6곳   직접 읽기만 · **봉합 제거 전**  ... 88da2db7^ 과 이 슬라이스 착수 시점
 *     5곳   직접 읽기만 · **봉합 제거 후**  ... 지금. 6번째는 항상-거짓 분기 자신이었다
 *
 *   🔑 6 → 5 는 결함이 아니라 **이 슬라이스의 산물**이다.
 *     사라진 하나가 `if (purchaseRequest.organizationId)` — 읽기이면서 동시에
 *     도달을 막던 분기였다. 그걸 걷는 게 "소생" 이므로 계수가 줄어드는 게 정상이다.
 *     🛑 "줄었으니 회귀" 로 읽으면 봉합을 되돌리게 된다 — RED 를 볼 때
 *       "무엇이 나빠졌나" 전에 **"무엇이 좋아졌나"** 를 먼저 묻는다(§sweep).
 *
 *   축 분리: 직접 5곳은 이 파일이 잠근다. team 경유 1곳은 성격이 다르고
 *   ((나)-1 이 직결로 교체) 아래 미해결 축 단언이 따로 든다.
 *
 * 🔑 이 파일이 잠그는 것은 "필드가 있다" 가 아니라 **"봉합이 걷혔다"** 이다.
 *   유령 시절의 방어(`?? ""` · `if (...)`)가 남아 있으면 필드가 생겨도 동작은 그대로다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const APPROVE = "src/app/api/request/[id]/approve/route.ts";

describe("계수 — 직접 읽기 5곳 (축과 시점을 고정한다)", () => {
  it("purchaseRequest.organizationId 직접 읽기가 정확히 5곳 (봉합 제거 후)", () => {
    /* 착수 시점 6 → 지금 5. 줄어든 하나가 항상-거짓 분기 자신이다.
     * 6 으로 되돌아가면 봉합이 부활했다는 뜻이므로 그때 RED 가 맞다. */
    const code = stripComments(read(APPROVE));
    const hits = code.match(/purchaseRequest\.organizationId/g) ?? [];
    expect(hits.length).toBe(5);
  });

  it("team 경유 읽기는 1곳 — 아직 미해결 축이다 ((나)-1 대상)", () => {
    /* 🛑 긍정 단언이다. (나)-1 이 이 줄을 직결로 바꾸면 **여기가 RED 로 떨어진다** —
     * 그때 이 it 을 "직결로 전환됨" 단언으로 교체하는 것이 정상 종료다.
     * 축이 미해결인 동안 그 사실을 기록으로만 두지 않기 위해 발화시킨다. */
    const code = stripComments(read(APPROVE));
    const viaTeam = code.match(/purchaseRequest\.team\?\.organizationId/g) ?? [];
    expect(viaTeam.length).toBe(1);
    expect(code).toMatch(/const orgId = purchaseRequest\.team\?\.organizationId;/);
  });
});

describe("🛑 봉합 제거 — 유령 시절 방어가 남으면 필드가 생겨도 동작은 그대로다", () => {
  it('개인 결재 한도 게이트에서 `?? ""` 가 걷혔다', () => {
    /* 유령 시절: undefined → "" → findFirst null → approvalLimit null(=무제한)
     * → checkApprovalLimit 이 전부 통과. **한도 게이트가 통째로 우회됐다.** */
    const code = stripComments(read(APPROVE));
    expect(code).not.toMatch(/purchaseRequest\.organizationId \?\? ""/);
    const win = code.match(
      /db\.organizationMember\.findFirst\(\{[\s\S]{0,400}?\}\)/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organizationId: purchaseRequest\.organizationId,/);
    expect(win).toMatch(/select: \{ approvalLimit: true \}/);
  });

  it("예산 경고 org 브로드캐스트에서 항상-거짓 분기가 걷혔다", () => {
    /* 유령 시절: if (purchaseRequest.organizationId) 가 항상 거짓 →
     * OWNER+ADMIN 브로드캐스트가 한 번도 돌지 않았고 수신자는 요청자 1명뿐이었다. */
    const code = stripComments(read(APPROVE));
    expect(code).not.toMatch(/if \(purchaseRequest\.organizationId\)/);
  });
});

describe("소생 4지점 — 이제 무엇이 돌기 시작하는가", () => {
  it("① 개인 결재 한도 — actor 의 organizationMember 를 그 조직에서 찾는다", () => {
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(
      /db\.organizationMember\.findFirst\(\{[\s\S]{0,300}?organizationId: purchaseRequest\.organizationId,[\s\S]{0,200}?userId: session\.user\.id,/
    );
    expect(code).toMatch(/checkApprovalLimit\(/);
    expect(code).toMatch(/requiresHigherApprover: true/);
  });

  it("② POCandidate 조회 — 조직 필터가 실재한다", () => {
    /* 🛑 undefined 는 Prisma where 에서 **필터가 통째로 생략된다.**
     * 값이 안 들어간 게 아니라 **조건 자체가 없었다** — 다른 조직 후보까지 잡혔다.
     * §reachability: "쿼리(select/where 부재 = 전부 반환)" 행 그대로다. */
    const code = stripComments(read(APPROVE));
    const win = code.match(
      /tx\.pOCandidate\.findMany\(\{[\s\S]*?\n          \}\)/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organizationId: purchaseRequest\.organizationId,/);
    expect(win).toMatch(/quoteId: purchaseRequest\.quoteId,/);
  });

  it("③ POCandidate 생성 — 조직이 기록된다 (이전에는 NULL)", () => {
    /* prod 실측 2026-08-30: POCandidate 3행 전부 organizationId NULL.
     * (그 3행은 2026-06-13 시드이고 quoteId 도 NULL 이라 이 경로 산물은 아니다.) */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(
      /userId: purchaseRequest\.requesterId,\s*\n\s*organizationId: purchaseRequest\.organizationId,/
    );
  });

  it("④ Order 변환 서비스 — 조직이 전달된다", () => {
    const code = stripComments(read(APPROVE));
    const win = code.match(
      /convertPOCandidatesToOrders\(\s*\{[\s\S]{0,400}?\}/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organizationId: purchaseRequest\.organizationId,/);
  });

  it("⑤ 예산 경고 — OWNER+ADMIN 브로드캐스트가 도달 가능해졌다", () => {
    const code = stripComments(read(APPROVE));
    const win = code.match(
      /const recipientUserIds = new Set<string>\(\);[\s\S]{0,1400}?const recipients =/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organizationId: purchaseRequest\.organizationId,/);
    expect(win).toMatch(/role: \{ in: \["OWNER", "ADMIN"\] \}/);
    /* 요청자 단독 fallback 은 보존 — 브로드캐스트가 실패해도 알림이 사라지면 안 된다 */
    expect(win).toMatch(/recipientUserIds\.add\(purchaseRequest\.requesterId\)/);
  });
});

describe("🛑 아직 닫히지 않은 것 — 기록이 아니라 발화로 둔다", () => {
  it("③ 경로(teamId 없는 요청)는 승인 자체가 403 이라 예산 게이트에 도달하지 못한다", () => {
    /* work-queue/purchase-conversion request-approval 은 teamId 를 안 채운다.
     * 승인 라우트는 `teamId: purchaseRequest.teamId || ""` 로 teamMember 를 찾고
     * 없으면 403 이다 → **예산 게이트 앞에서 끊긴다.**
     * 따라서 "③ 경로 예산 게이트 첫 발화" 는 이 슬라이스에서 검증 불가이고,
     * (나)-1(TeamRole → APPROVER|ADMIN|OWNER · teamId||"" 제거)이 선행이다.
     * 🔑 이 단언은 그 사실을 **코드에 붙여 둔다** — (나)-1 이 배선을 바꾸면 RED 로
     *   떨어지고, 그때가 ③ 발화를 실측할 시점이라는 신호다. */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(/teamId: purchaseRequest\.teamId \|\| "",/);
    expect(code).toMatch(/teamMember\.role !== TeamRole\.ADMIN/);
    expect(code).toMatch(/if \(orgId && purchaseRequest\.quoteId\)/);
  });
});
