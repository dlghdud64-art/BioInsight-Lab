/**
 * #api-inventory-id-info-leak — Phase 1 RED
 *
 * Goal: `/api/inventory/[id]` GET / PATCH / DELETE 의 권한 분기가
 *       `inventory.userId !== session.user.id && !inventory.organizationId`
 *       — organizationId 가 있는 row 는 어떤 user 든 통과 (multi-tenant
 *       info leak, modify leak, delete leak 위험) drift 차단.
 *
 * canonical truth lock:
 *   - 3 spots (GET / PATCH / DELETE) 모두 isOwner OR isOrgMember 패턴 적용.
 *   - isOwner: inventory.userId === session.user.id
 *   - isOrgMember: OrganizationMember.findFirst({where:{userId, organizationId: inventory.organizationId}})
 *   - 둘 다 false → 403 (또는 404 existence leak avoidance, vendor-requests cluster 패턴)
 *   - userId / organizationId nullable 모두 graceful (legacy single-user row 호환)
 *
 * Out of scope (별도 sub-trial):
 *   - alerts / usage / lookup / reorder-recommendations (D 트랙 sweep)
 *   - bulk / scan / import / export-labels (행위별 별도 audit)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/inventory/[id]/route.ts");
const route = readFileSync(ROUTE_PATH, "utf8");

describe("#api-inventory-id-info-leak — drift sentinel", () => {
  it("GET 의 organizationId existence-only check (`!inventory.organizationId`) 단독 분기 잔존하지 않음", () => {
    // 옛 패턴: `inventory.userId !== session.user.id && !inventory.organizationId`
    // 새 패턴: isOwner + isOrgMember 분리 확인.
    expect(route).not.toMatch(
      /inventory\.userId\s*!==\s*session\.user\.id\s*&&\s*!inventory\.organizationId/,
    );
  });

  it("PATCH/DELETE 의 existingInventory.organizationId existence-only check 잔존하지 않음", () => {
    expect(route).not.toMatch(
      /existingInventory\.userId\s*!==\s*session\.user\.id\s*&&\s*!existingInventory\.organizationId/,
    );
  });
});

describe("#api-inventory-id-info-leak — ownership pattern guard", () => {
  it("OrganizationMember.findFirst 분기 추가 (3 spots 중 최소 1회 — 같은 helper 재사용 가능)", () => {
    expect(route).toMatch(/organizationMember\.findFirst/);
  });

  it("isOwner OR isOrgMember 패턴 키워드 (vendor-requests cluster 패턴)", () => {
    expect(route).toMatch(/isOwner|isOrgMember/);
  });

  it("cluster trace marker", () => {
    expect(route).toMatch(/#api-inventory-id-info-leak|info leak|조직 멤버|organization member/);
  });
});

describe("#api-inventory-id-info-leak — handler export 보존", () => {
  it("GET / PATCH / DELETE 3 export 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
    expect(route).toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("PATCH/DELETE 의 enforceAction wrapping 보존", () => {
    // enforceAction 호출이 PATCH 와 DELETE 둘 다 보존 — RBAC layer 분리.
    const enforceMatches = route.match(/enforceAction\(/g) || [];
    expect(enforceMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("audit log 기록 호출 보존 (PATCH + DELETE)", () => {
    /* 🔑 승계 (§entity-type-canonical 4 · 2026-09-10): 심볼이 `createAuditLog` →
     *   `createDataAuditLog` 로 **개명**됐다. 같은 이름의 헬퍼가 둘이었고(→AuditLog /
     *   →DataAuditLog) import 경로로만 갈려, 2026-09-07 "초대 수락 감사 0" 오보의 뿌리였다.
     *   명제는 "**감사 기록이 두 핸들러에서 남는다**" 이지 심볼 철자가 아니다.
     *   이 라우트는 `@/lib/audit`(→DataAuditLog) 쪽을 쓴다. */
    const auditMatches = route.match(/createDataAuditLog\(/g) || [];
    expect(auditMatches.length).toBeGreaterThanOrEqual(2);
  });
});
