/**
 * §11.345-B (회귀) — 감사 추적 write단 보강 sentinel
 *
 * Part 11 audit trail: Who/When/What 외 IP + before/after(changes) 보강.
 *   - auditRequestMeta 헬퍼(IP/UA) 존재
 *   - quote_pdf_generate 재분류(SETTINGS_CHANGED → DATA_EXPORTED, export 라 changes 없음 정상)
 *   - 고가치 value-change 라우트는 changes + IP(auditRequestMeta) 동시 보유
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

describe("§11.345-B — IP/UA 헬퍼", () => {
  it("audit-logger 에 auditRequestMeta export", () => {
    const src = read("src/lib/audit/audit-logger.ts");
    expect(src).toMatch(/export function auditRequestMeta/);
    expect(src).toMatch(/x-forwarded-for/);
    expect(src).toMatch(/x-real-ip/);
  });
});

describe("§11.345-B — quote PDF 재분류", () => {
  it("generate-pdf: DATA_EXPORTED + auditRequestMeta (SETTINGS_CHANGED 제거)", () => {
    const src = read("src/app/api/quotes/[id]/generate-pdf/route.ts");
    expect(src).toMatch(/eventType:\s*"DATA_EXPORTED"/);
    expect(src).not.toMatch(/eventType:\s*"SETTINGS_CHANGED"/);
    expect(src).toMatch(/auditRequestMeta\(request\)/);
  });
});

describe("§11.345-B — 고가치 value-change 라우트 changes + IP", () => {
  const cases: Array<[string, string]> = [
    ["src/app/api/organizations/[id]/security/route.ts", "update_security_settings"],
    ["src/app/api/admin/users/[id]/approval-policy/route.ts", "approval_policy_update"],
    ["src/app/api/workspaces/[id]/route.ts", "threshold_update"],
  ];
  for (const [path, action] of cases) {
    it(`${action} — changes + auditRequestMeta`, () => {
      const src = read(path);
      expect(src).toMatch(/changes:\s*\{/);
      expect(src).toMatch(/auditRequestMeta\(request\)/);
    });
  }
});
