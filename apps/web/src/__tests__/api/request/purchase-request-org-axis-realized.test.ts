/**
 * §purchase-request-org-axis #실재화 — 유령 참조가 실제 컬럼 위에서 무엇을 하는가
 *   (호영님 지시 2026-08-30 "7곳 실재화 · :546 소생 + 동작 검증")
 *
 * 카드: docs/handoff/CARD_approver-axis-splits-in-one-screen.md
 *
 * 🛑 계수 정정 — 세 번 움직였다. **축과 시점을 함께 적는다**(§2b 사례 1·2·3).
 *
 *     7곳   직접 6 + team 경유 1(`:156`)   ... 단위가 섞였다
 *     6곳   직접만 · **봉합 제거 전**       ... 88da2db7^ 과 #실재화 착수 시점
 *     5곳   직접만 · **봉합 제거 후**       ... #실재화 종료. 6번째는 항상-거짓 분기 자신
 *     6곳   직접만 · **(나)-1a 직결 후**    ... 지금. team 경유 1이 직접으로 넘어왔다
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

describe("계수 — 직접 읽기 6곳 (축과 시점을 고정한다)", () => {
  it("purchaseRequest.organizationId 직접 읽기가 정확히 6곳 ((나)-1a 직결 후)", () => {
    /* 5 → 6. 늘어난 하나는 team 경유가 직접으로 넘어온 것이다(orgId).
     * 계수가 움직일 때마다 무엇이 움직였는지를 함께 적는다 — 숫자만 고치면
     * 다음 세션이 "왜 6인가" 를 못 판정한다. */
    const code = stripComments(read(APPROVE));
    const hits = code.match(/purchaseRequest\.organizationId/g) ?? [];
    expect(hits.length).toBe(6);
  });

  it("🔑 (나)-1a 종료 — team 경유 읽기가 0곳이다", () => {
    /* 직전 판본은 `team 경유 1곳` 을 **긍정으로** 잠그고 있었다. (나)-1a 가 그것을
     * 직결로 바꿔 예고대로 RED 를 냈고, 여기서 승계 교체한다 — 그게 정상 종료다.
     * 🛑 역방향 잠금: team 경유가 되살아나면 RED. teamId 가 null 인 생성 경로에서
     *   orgId 가 다시 undefined 가 되고 예산 게이트가 다시 스킵된다. */
    const code = stripComments(read(APPROVE));
    expect(code.match(/purchaseRequest\.team\?\./g) ?? []).toHaveLength(0);
    expect(code).toMatch(/const orgId = purchaseRequest\.organizationId;/);
  });

  it("소속 축은 include 도 직결이다 — team 통로 제거", () => {
    /* team include 는 organization 에 닿기 위한 **통로일 뿐**이었다.
     * 통로가 남아 있으면 다음 세션이 "team 축이 아직 산다" 로 읽는다. */
    const code = stripComments(read(APPROVE));
    const win = code.match(
      /db\.purchaseRequest\.findUnique\(\{[\s\S]{0,600}?\n    \}\)/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organization: \{ select: \{ id: true, timezone: true \} \},/);
    expect(win).not.toMatch(/team: \{/);
  });

  it("예산 기간 타임존도 직결이다 — 조용히 틀린 값이 들어가던 자리", () => {
    /* orgTimezone 은 periodYearMonth(예산 기간 키)를 정한다. team 이 끊긴 요청에서
     * "Asia/Seoul" 로 떨어지면 **값이 없는 게 아니라 틀린 값**이 들어간다.
     * 비서울 조직의 예산이 다른 달에 계상된다 — 부재보다 나쁜 형태다. */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(
      /const orgTimezone = purchaseRequest\.organization\?\.timezone \?\? "Asia\/Seoul";/
    );
    expect(code).not.toMatch(/purchaseRequest\.team\?\.organization\?\.timezone/);
    expect(code).toMatch(/resolvePeriodYearMonth\(orgTimezone, approvalTimestamp\)/);
  });
});

describe("🛑 봉합 제거 — 유령 시절 방어가 남으면 필드가 생겨도 동작은 그대로다", () => {
  it('개인 결재 한도 게이트에서 `?? ""` 가 걷혔다', () => {
    /* 유령 시절: undefined → "" → findFirst null → approvalLimit null(=무제한)
     * → checkApprovalLimit 이 전부 통과. **한도 게이트가 통째로 우회됐다.** */
    const code = stripComments(read(APPROVE));
    expect(code).not.toMatch(/purchaseRequest\.organizationId \?\? ""/);
    const win = code.match(
      /db\.organizationMember\.findUnique\(\{[\s\S]{0,400}?\}\)/
    )?.[0] ?? "";
    expect(win.length).toBeGreaterThan(0);
    expect(win).toMatch(/organizationId: purchaseRequest\.organizationId,/);
    expect(win).toMatch(/select: \{ role: true, approvalLimit: true \}/);
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
      /db\.organizationMember\.findUnique\(\{[\s\S]{0,300}?userId: session\.user\.id,[\s\S]{0,200}?organizationId: purchaseRequest\.organizationId,/
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

describe("🔑 (나)-1b 종료 — 게이트 축이 조직 역할로 옮겼다", () => {
  it("TeamRole 게이트가 사라졌다 — 직전 판본이 긍정으로 잠그던 자리", () => {
    /* 직전 판본은 `teamId || ""` 와 `TeamRole.ADMIN` 을 **긍정으로** 잠그고
     * "③ 는 여기서 403 이라 도달 불가" 를 발화시키고 있었다. (나)-1b 가 그것을
     * 교체해 예고대로 RED 를 냈고, 여기서 승계한다 — 정상 종료다.
     * 🛑 역방향 잠금: TeamRole 게이트가 되살아나면 RED. prod Team 0 · TeamMember 0
     *   이므로 그 게이트에서는 **아무도 승인할 수 없다.** */
    const code = stripComments(read(APPROVE));
    expect(code).not.toMatch(/TeamRole/);
    expect(code).not.toMatch(/teamMember/);
    expect(code).not.toMatch(/purchaseRequest\.teamId/);
  });

  it("A축 정본을 import 한다 — 사본을 두지 않는다", () => {
    /* 🛑 역할 집합을 이 파일에 인라인으로 쓰면 측정된 5정의에 여섯 번째가 붙는다.
     * 정본은 lib/billing/approver-routing.ts 의 ORG_APPROVER_ROLES 다. */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(/import \{ isOrgApprover \} from "@\/lib\/billing\/approver-routing"/);
    expect(code).toMatch(/if \(!isOrgApprover\(actorOrgMembership\?\.role\)\)/);
    /* 🛑 창을 게이트 블록으로 좁힌다. 파일 전역으로 걸면 예산 경고 브로드캐스트의
     * `role: { in: ["OWNER", "ADMIN"] }` 가 걸린다 — 그것은 **다른 집합**이다
     * (승인권자가 아니라 경고 수신자). 결정은 "게이트가 A축 사본을 두지 않는다" 이지
     * "파일에 역할 문자열이 없다" 가 아니다. §4-a-2 · 같은 형태 3회차. */
    const gate = code.match(
      /const actorOrgMembership[\s\S]{0,700}?checkApprovalLimit\(/
    )?.[0] ?? "";
    expect(gate.length).toBeGreaterThan(0);
    expect(gate).not.toMatch(/"APPROVER"/);
    expect(gate).not.toMatch(/"OWNER"/);
  });

  it("정본 자체 — ORG_APPROVER_ROLES 는 APPROVER · ADMIN · OWNER 다", () => {
    const lib = stripComments(read("src/lib/billing/approver-routing.ts"));
    expect(lib).toMatch(
      /export const ORG_APPROVER_ROLES = \["APPROVER", "ADMIN", "OWNER"\] as const;/
    );
    expect(lib).toMatch(/export function isOrgApprover\(role: string \| null \| undefined\): boolean/);
    /* 비멤버(null)는 승인권 없음 — 역방향 잠금 */
    expect(lib).toMatch(/return !!role &&/);
  });

  it("역할과 한도를 같은 행에서 읽는다 — 두 판정이 다른 행을 보면 안 된다", () => {
    const code = stripComments(read(APPROVE));
    const win = code.match(
      /db\.organizationMember\.findUnique\(\{[\s\S]{0,400}?\}\)/
    )?.[0] ?? "";
    expect(win).toMatch(/select: \{ role: true, approvalLimit: true \}/);
    /* 판정용 조회는 하나여야 한다 — findUnique 가 2회면 역할과 한도가 다른 행에서
     * 읽힐 수 있다. findMany 는 세지 않는다: 예산 경고 브로드캐스트가 쓰는 **다른
     * 목적**의 조회이고, 이것까지 묶으면 그쪽을 못 바꾸게 된다. */
    expect(code.match(/db\.organizationMember\.findUnique/g) ?? []).toHaveLength(1);
    expect(code).toMatch(/db\.organizationMember\.findMany/);
  });

  it("③ 경로가 이제 예산 게이트에 도달한다 — 배선 3단이 모두 서 있다", () => {
    /* 🔑 도달 조건: ① 소속 축이 직결이고 ② 게이트가 조직 역할이고 ③ 예산 분기가
     * orgId 를 본다. 셋 중 하나라도 끊기면 ③ 는 다시 도달 불가가 된다. */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(/const orgId = purchaseRequest\.organizationId;/);
    expect(code).toMatch(/if \(!isOrgApprover\(actorOrgMembership\?\.role\)\)/);
    expect(code).toMatch(/if \(orgId && purchaseRequest\.quoteId\)/);
  });
});

describe("🛑 아직 닫히지 않은 것 — 기록이 아니라 발화로 둔다", () => {
  it("예산 게이트가 Product 에 없는 필드를 select 한다 — 발화 이전에 던진다", () => {
    /* 🛑 (나)-1b tvkl 통합 실측에서 나온 **블로커** (2026-08-30).
     *
     *   approve/route.ts 는 `product: { select: { normalizedCategoryId: true } }` 를
     *   쓰는데 **Product 모델에 그 필드가 없다.** schema.prisma 에도 없고 두 DB 에도 없다
     *   (PurchaseRecord · MutationAuditEvent 에만 있다).
     *   tvkl 실측: 같은 쿼리가 Prisma validation 에서 던졌다.
     *
     * 왜 지금까지 안 보였나 — **두 결함이 서로를 가렸다**(§4b 상호 참조):
     *   ① 이 select 를 타는 분기가 orgId undefined 로 **도달 불가**였다
     *   ② withSerializableBudgetTx 의 tx 가 `any` 라 **tsc 가 못 잡는다**
     *   1a·1b 가 ①을 열자 ②가 남긴 결함이 드러났다.
     *
     * 🔑 그래서 ③ 예산 게이트 첫 발화는 **아직 실측 불가**다 — 게이트에 도달은 하지만
     *   그 안에서 던진다. mock 계약 테스트는 이 select 를 mock 하므로 **통과시킨다** —
     *   "발화한다" 는 mock 단언을 쓰면 그것이 false GREEN 이다(§4b: 도구가 도는 것과
     *   검증이 실물에 닿는 것은 다르다). 그래서 쓰지 않았다.
     *
     * 처방은 판정 사안이다: 카테고리를 Product 에 FK 로 다는가, ProductCategory →
     * SpendingCategory 매핑을 쓰는가(suggestCategoryMapping 은 backfill 전용 · 호출 금지),
     * 아니면 미분류 null 로 두는가. 임의로 고르지 않는다.
     *
     * 이 단언은 현행(결함) 상태를 잠근다 — 고치면 RED 로 떨어지고, 그때가 ③ 발화를
     * 실측할 시점이다. */
    const code = stripComments(read(APPROVE));
    expect(code).toMatch(
      /include: \{ product: \{ select: \{ category: true, normalizedCategoryId: true \} \} \},/
    );
    const schema = read("prisma/schema.prisma");
    const productModel = schema.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(productModel.length).toBeGreaterThan(0);
    expect(productModel).not.toMatch(/normalizedCategoryId/);
  });

  it("표면은 아직 TeamRole 축이다 — quotes/[id] canApprove ((나)-2 대상)", () => {
    /* 🛑 (나)-1b 가 서버를 A축으로 옮기면서 **표면과 갈라졌다.**
     *   서버: APPROVER · ADMIN · OWNER (조직 축)
     *   표면: quotes/[id]/route.ts 의 canApprove 는 여전히 TeamRole.ADMIN (팀 축)
     * → 승인 권한이 있는 사람에게 CTA 가 숨는다. dead button 의 반대 방향
     *   (살아 있는데 감춰진 버튼)이고, quote-detail-canapprove sentinel 이
     *   "canApprove === false 시 CTA hide" 를 계약으로 잠그고 있어 결정 교체가 필요하다.
     * 🔑 prod 실측상 TeamMember 0 이라 그 표면은 **이전에도 항상 false** 였다 —
     *   실사용 회귀는 0 이고 정합 부채만 남는다. 그래도 기록이 아니라 발화로 둔다.
     *   (나)-2 가 표면을 A축으로 옮기면 여기가 RED 로 떨어진다. */
    const quoteRoute = stripComments(read("src/app/api/quotes/[id]/route.ts"));
    expect(quoteRoute).toMatch(/memberForApproval\?\.role === TeamRole\.ADMIN/);
  });
});
