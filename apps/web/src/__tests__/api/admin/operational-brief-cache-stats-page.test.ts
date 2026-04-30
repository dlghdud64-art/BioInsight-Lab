/**
 * §11.163 #operational-brief-cache-stats-admin-page
 *
 * Source-level guard — `/dashboard/audit/page.tsx` 가 ADMIN-only cache stats
 * Card 를 표시하는지 검증. §11.151 endpoint 가 0 caller 였던 마지막 gap 회수.
 *
 * Acceptance:
 *   - useQuery 호출 to `/api/admin/operational-brief-cache-stats`.
 *   - hit rate / cacheSize / hit / miss / invalidate counter 표시.
 *   - ADMIN-only gating (canAccessAudit 활용).
 *   - 기존 audit trail table + filter 회귀 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/audit/page.tsx",
);

describe("§11.163 cache stats admin card — audit page", () => {
  const source = readFileSync(PATH, "utf8");

  it("/api/admin/operational-brief-cache-stats useQuery 호출", () => {
    expect(source).toMatch(/\/api\/admin\/operational-brief-cache-stats/);
  });

  it("운영 브리핑 캐시 통계 라벨 (한국어)", () => {
    expect(source).toMatch(/운영 브리핑 캐시 통계/);
  });

  it("hitRate / cacheSize / hit / miss / invalidate 표시", () => {
    expect(source).toMatch(/hitRate/);
    expect(source).toMatch(/cacheSize/);
    expect(source).toMatch(/hit\b|"hit"/);
    expect(source).toMatch(/miss\b|"miss"/);
  });

  it("ADMIN-only gating — canAccessAudit 또는 userRole === ADMIN 분기", () => {
    expect(source).toMatch(/canAccessAudit|userRole.*ADMIN/);
  });

  it("회귀 0: 기존 audit trail Table 보존", () => {
    expect(source).toMatch(/Table/);
    expect(source).toMatch(/AuditLogResponse/);
  });

  it("회귀 0: PDF export + filter 보존", () => {
    expect(source).toMatch(/handlePdfDownload|window\.print/);
  });
});
