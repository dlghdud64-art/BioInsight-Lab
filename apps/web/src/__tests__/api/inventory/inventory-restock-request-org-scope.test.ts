/**
 * #api-inventory-restock-request-org-scope — Phase 1 RED
 *
 * Goal: `/api/inventory/[id]/restock-request` POST 의 ownership 분기가
 *       `inventory.userId !== session.user.id` 단독 — 같은 organization 의
 *       다른 user 가 만든 inventory (pilot 의 organizationId-only row 포함)
 *       에서 restock-request 생성 차단 (multi-user collaboration drift).
 *
 * canonical truth lock:
 *   - POST line 68 의 ownership 분기 swap — isOwner OR isOrgMember.
 *   - isOwner: inventory.userId === session.user.id
 *   - isOrgMember: OrganizationMember.findFirst({where:{userId, organizationId}})
 *   - 둘 다 false → 403 보존 ("Forbidden: Not your inventory" 메시지 보존
 *     또는 한국어 swap 후속 트랙).
 *
 *   - GET 은 fetch 가 `requesterId: session.user.id` 자체로 self-scoped → drift 0.
 *   - TeamMember 분기 + ADMIN 차단 logic 별개 — 본 cluster 범위 외.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/inventory/[id]/restock-request/route.ts",
);
const route = readFileSync(ROUTE_PATH, "utf8");

describe("#api-inventory-restock-request-org-scope — drift sentinel", () => {
  it("POST 의 단독 user-level ownership 분기 잔존하지 않음", () => {
    // 옛 패턴: `if (inventory.userId !== session.user.id) { Forbidden }` 단독.
    // 새 패턴: isOwner OR isOrgMember 분기.
    expect(route).not.toMatch(
      /if\s*\(\s*inventory\.userId\s*!==\s*session\.user\.id\s*\)\s*\{\s*[\s\S]{0,80}Forbidden:?\s*Not your inventory/,
    );
  });
});

describe("#api-inventory-restock-request-org-scope — ownership pattern guard", () => {
  it("OrganizationMember.findFirst 분기 추가", () => {
    expect(route).toMatch(/organizationMember\.findFirst/);
  });

  it("isOwner OR isOrgMember 키워드 (cluster pattern)", () => {
    expect(route).toMatch(/isOwner|isOrgMember/);
  });

  it("cluster trace marker", () => {
    expect(route).toMatch(/#api-inventory-restock-request-org-scope|#api-inventory-id-info-leak|조직 멤버|organization member|multi-user/);
  });
});

describe("#api-inventory-restock-request-org-scope — handler 보존", () => {
  it("POST + GET 2 export 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("enforceAction wrapping 보존 (POST)", () => {
    expect(route).toMatch(/enforceAction\(/);
  });

  it("TeamMember 분기 보존 (별개 layer)", () => {
    expect(route).toMatch(/teamMember\.findFirst/);
  });

  it("PurchaseRequest.create 본 경로 보존", () => {
    expect(route).toMatch(/purchaseRequest\.create/);
  });

  it("ADMIN 차단 분기 보존 (TeamRole.ADMIN)", () => {
    expect(route).toMatch(/TeamRole\.ADMIN/);
  });
});

describe("#api-inventory-restock-request-org-scope — GET 정합 보존", () => {
  it("GET 의 self-scoped fetch (requesterId 본인) 보존", () => {
    expect(route).toMatch(/requesterId:\s*session\.user\.id/);
  });
});
