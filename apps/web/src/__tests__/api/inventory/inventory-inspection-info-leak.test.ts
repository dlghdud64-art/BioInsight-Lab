/**
 * #api-inventory-inspection-info-leak — Phase 1 RED
 *
 * Goal: `/api/inventory/[id]/inspection` GET (점검 이력 조회) + POST (점검
 *       기록 생성) 의 권한 분기가 `inventory.userId !== session.user.id &&
 *       !inventory.organizationId` — organizationId 가 있는 row 는 어떤
 *       user 든 통과 (multi-tenant info leak / unauthorized inspection
 *       create 위험) drift 차단.
 *
 * canonical truth lock:
 *   - 2 spots (GET / POST) 모두 isOwner OR isOrgMember 패턴 적용 — C cluster
 *     (#api-inventory-id-info-leak) 의 sweep #2.
 *   - isOwner: inventory.userId === session.user.id
 *   - isOrgMember: OrganizationMember.findFirst({where:{userId, organizationId}})
 *   - 둘 다 false → 403
 *   - POST 의 enforceAction (RBAC layer) 보존 — ownership check 와 분리.
 *
 * Out of scope (별도 sub-trial):
 *   - [id]/use / restock / restock-request / receive — 이미 OrganizationMember
 *     패턴 보유 또는 별도 audit (mutation 별 RBAC).
 *   - auto-reorder / alerts/send / bulk / usage / scan 등 — 별도 cluster.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/inventory/[id]/inspection/route.ts",
);
const route = readFileSync(ROUTE_PATH, "utf8");

describe("#api-inventory-inspection-info-leak — drift sentinel", () => {
  it("GET 의 organizationId existence-only check 단독 분기 잔존하지 않음", () => {
    expect(route).not.toMatch(
      /inventory\.userId\s*!==\s*session\.user\.id\s*&&\s*!inventory\.organizationId/,
    );
  });
});

describe("#api-inventory-inspection-info-leak — ownership pattern guard", () => {
  it("OrganizationMember.findFirst 분기 추가", () => {
    expect(route).toMatch(/organizationMember\.findFirst/);
  });

  it("isOwner OR isOrgMember 키워드 (cluster pattern)", () => {
    expect(route).toMatch(/isOwner|isOrgMember/);
  });

  it("cluster trace marker", () => {
    expect(route).toMatch(/#api-inventory-inspection-info-leak|#api-inventory-id-info-leak|info leak|조직 멤버|organization member/);
  });
});

describe("#api-inventory-inspection-info-leak — handler export 보존", () => {
  it("GET / POST 2 export 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("POST 의 enforceAction wrapping 보존 (RBAC layer 분리)", () => {
    expect(route).toMatch(/enforceAction\(/);
  });

  it("Inspection.create 호출 보존 (mutation 본 경로)", () => {
    expect(route).toMatch(/inspection\.create/);
  });
});
