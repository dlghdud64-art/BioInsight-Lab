/**
 * §purchase-request-org-axis — PurchaseRequest 소속 축 (호영님 판정 2026-08-30)
 *
 * 카드: docs/handoff/CARD_approver-axis-splits-in-one-screen.md
 *
 * 왜 NOT NULL 인가 (이 슬라이스의 존재 근거):
 *   🛑 **예산 검증이 필요한 유일한 경로가 소속 축 부재로 그 검증을 건너뛰고 있었다.**
 *   quoteId 를 채우는 유일한 생성 지점(work-queue/purchase-conversion request-approval)이
 *   teamId 를 안 채웠고, 승인 라우트의 `orgId = purchaseRequest.team?.organizationId` 가
 *   undefined 라 `if (orgId && quoteId)` 예산 게이트가 통째로 스킵됐다.
 *   소속 축 부재가 곧 예산 통제 부재였다.
 *   nullable 로 넣으면 코드 7곳의 방어(`?? ""` · `if(...)`)가 그대로 살아 "없는 필드" 가
 *   "null 일 수 있는 필드" 로 바뀔 뿐이다. prod 0행이라 required 로 갈 수 있는 유일한 시점.
 *
 * 파생 규칙 (조문 — 스키마 주석이 아니라 여기서 잠근다):
 *   teamId 있음   organizationId = team.organizationId   → 조건 3 이 정의상 성립
 *   teamId 없음   서버 파생 (workspace 축) + 멤버십 게이트
 *   판정          전 경로 공통 — 요청자의 organizationMember 존재
 *                 🔑 파생은 team/workspace 축, **판정은 organizationMember 축**.
 *                    귀속 정확 != 행위 허용.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const SCHEMA = "prisma/schema.prisma";
const R1 = "src/app/api/inventory/[id]/restock-request/route.ts";
const R2 = "src/app/api/request/route.ts";
const R3 = "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

describe("스키마 — organizationId 는 NOT NULL 이다", () => {
  it("PurchaseRequest.organizationId String (optional 아님)", () => {
    const model = read(SCHEMA).match(/model PurchaseRequest \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(model.length).toBeGreaterThan(0);
    expect(model).toMatch(/^\s*organizationId String$/m);
    /* 🛑 역방향 잠금 — nullable 로 되돌리면 RED. 그 순간 7곳의 방어가 정당해지고
     * "없는 필드" 가 "null 일 수 있는 필드" 로 바뀔 뿐이다. */
    expect(model).not.toMatch(/organizationId String\?/);
    expect(model).toMatch(/organization Organization @relation\(fields: \[organizationId\]/);
  });
});

describe("생성 3지점 — 파생 규칙 2갈래", () => {
  it("① 재입고: teamId 있음 → team.organizationId 파생", () => {
    const c = stripComments(read(R1));
    expect(c).toMatch(/const reqOrgId = teamMember\.team\.organizationId;/);
    expect(c).toMatch(/organizationId: reqOrgId,/);
    expect(c).toMatch(/teamId: teamMember\.teamId,/);
  });

  it("② 요청 생성: teamId 있음 → team 조회 후 team.organizationId 파생", () => {
    const c = stripComments(read(R2));
    expect(c).toMatch(/const team = await db\.team\.findUnique\(\{[\s\S]{0,120}?select: \{ organizationId: true \}/);
    expect(c).toMatch(/organizationId: team\.organizationId,[\s\S]{0,40}?teamId,/);
  });

  it("③ 결재 요청: teamId 없음 → workspace 축 서버 파생", () => {
    const c = stripComments(read(R3));
    expect(c).toMatch(/const orgId = member\?\.workspace\?\.organizationId;/);
    expect(c).toMatch(/organizationId: orgId,[\s\S]{0,40}?approverId,/);
    /* teamId 를 안 채운다는 사실 자체가 파생 갈래 2의 근거 — 채우기 시작하면
     * 갈래 1로 옮겨야 하므로 그때 이 단언이 RED 로 알린다. */
    expect(c).not.toMatch(/teamId[,:][\s\S]{0,60}?purchaseRequest\.create/);
  });
});

describe("🔑 판정 축 — 전 경로가 organizationMember 게이트를 통과한다", () => {
  it("세 생성 지점 모두 요청자의 organizationMember 를 확인한다", () => {
    for (const rel of [R1, R2, R3]) {
      const c = stripComments(read(rel));
      expect(c).toMatch(/db\.organizationMember\.findUnique\(\{[\s\S]{0,200}?userId_organizationId/);
      expect(c).toMatch(/Not a member of this organization/);
    }
  });

  it("🛑 바디 유래 organizationId 부재 — 클라이언트가 조직을 고르지 않는다", () => {
    /* protocol/bom 격리 감사가 뚫린 자리가 정확히 이것이다 —
     * 클라이언트 공급 organizationId 로 남의 조직에 행을 만들었다. */
    for (const rel of [R1, R2, R3]) {
      const c = stripComments(read(rel));
      expect(c).not.toMatch(/const \{[^}]*organizationId[^}]*\} = body/);
      expect(c).not.toMatch(/body\.organizationId/);
      expect(c).not.toMatch(/organizationId: body\./);
    }
  });
});

describe("조건 3 — teamId 와 organizationId 정합", () => {
  it("teamId 를 채우는 두 경로는 organizationId 를 같은 team 행에서 파생한다", () => {
    /* 정의상 성립 — 런타임 검증이 아니라 파생 구조로 보장한다.
     * 검증할 것을 줄이는 파생이 검증을 추가하는 파생보다 낫다 (호영님 판정). */
    const c1 = stripComments(read(R1));
    expect(c1).toMatch(/reqOrgId = teamMember\.team\.organizationId/);
    /* 창을 create 블록으로 좁힌다 — 파일 전역으로 걸면 :75 의 인벤토리 접근 검증
     * (`organizationId: inventory.organizationId`)이 걸린다. 그것은 다른 축이고
     * 살아 있어야 한다. 결정은 "요청 행의 org 가 team 에서 온다" 이지
     * "파일에 inventory.organizationId 가 없다" 가 아니다. */
    const create1 = c1.match(/db\.purchaseRequest\.create\(\{[\s\S]*?\n    \}\)/)?.[0] ?? "";
    expect(create1.length).toBeGreaterThan(0);
    expect(create1).toMatch(/organizationId: reqOrgId,/);
    expect(create1).not.toMatch(/organizationId: (inventory|session)/);
    const c2 = stripComments(read(R2));
    expect(c2).toMatch(/organizationId: team\.organizationId/);
    /* 🛑 요청자의 organizationMember 에서 파생하면 조건 3 이 런타임 검증 대상이 된다 */
    expect(c2).not.toMatch(/organizationId: orgMembership\./);
  });
});
