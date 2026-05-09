/**
 * #api-inventory-organization-scope-auto — Phase 1 RED
 *
 * Goal: `/api/inventory` GET 의 ownerCondition 이 organizationId queryString
 *       없으면 userId only — pilot/multi-user organization 의 organizationId
 *       scoped row (PILOT_INVENTORY_CATALOG, 호영님 organization 의 다른 user 가
 *       만든 row) 가 안 보이는 drift 차단.
 *
 * canonical truth lock:
 *   - GET 이 OrganizationMember.findMany 자동 호출 → user 의 모든 organizationId
 *     수집 → ownerCondition.OR 에 자동 forward.
 *   - organizationId queryString 보존 (특정 org 만 보고 싶을 때 explicit override).
 *   - { userId: user.id } 분기 보존 (legacy single-user row 호환).
 *
 * Out of scope (별도 sub-trial):
 *   - /api/inventory/[id] GET 의 organizationId existence-only check (info leak 위험)
 *   - alerts / usage / lookup / reorder-recommendations 의 동일 drift sweep
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/inventory/route.ts");
const route = readFileSync(ROUTE_PATH, "utf8");

describe("#api-inventory-organization-scope-auto — GET source guard", () => {
  it("GET export 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("OrganizationMember.findMany auto query (organizationIds 수집)", () => {
    // GET 안에서 `organizationMember.findMany` 또는 동일 패턴 (memberships) 호출.
    expect(route).toMatch(/organizationMember\.findMany/);
  });

  it("ownerCondition 의 OR 분기에 organizationIds forward", () => {
    // organizationId queryString 없을 때도 조직 멤버십 organizationId 가 OR 에
    // 들어가야 함. 키워드 매칭: `orgIds` 또는 `memberships` 또는 `organizationIds`
    // 가 OR 분기에 spread.
    expect(route).toMatch(/orgIds|organizationIds|memberships/);
  });

  it("userId 분기 보존 (legacy single-user row 호환)", () => {
    expect(route).toMatch(/userId:\s*user\.id/);
  });

  it("organizationId queryString 보존 (explicit override 가능)", () => {
    // searchParams.get("organizationId") 가 여전히 사용됨 — explicit override path 보존.
    expect(route).toMatch(/searchParams\.get\(["']organizationId["']\)/);
  });

  it("cluster trace marker", () => {
    expect(route).toMatch(/#api-inventory-organization-scope-auto|조직 멤버|organization member/);
  });
});

describe("#api-inventory-organization-scope-auto — drift 차단 sentinel", () => {
  it("ownerCondition 이 userId only 단독 분기로 fall through 하지 않음", () => {
    // 옛 패턴: `OR: [{ userId: user.id }, ...(organizationId ? [...] : [])]`
    // 새 패턴: organizationId 없을 때도 organizationIds spread.
    // sentinel: `: []` 의 ternary fallback 이 단독으로 남아있지 않아야 함 (즉
    // ` : orgIds.map` 또는 ` : organizationIds.map` 같은 fallback 필수).
    expect(route).not.toMatch(/organizationId\s*\?\s*\[\{\s*organizationId\s*\}\s*\]\s*:\s*\[\]/);
  });
});
