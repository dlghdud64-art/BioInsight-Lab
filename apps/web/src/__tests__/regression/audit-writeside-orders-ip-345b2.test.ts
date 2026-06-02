/**
 * §11.345-B2 (회귀) — 발주 클러스터 write단 IP 보강 sentinel
 *
 * orders/[id]/route(PATCH), send-email(POST), generate-pdf(POST) 의 createAuditLog 가
 *   auditRequestMeta(request) 로 IP/UA 를 캡처하는지 확인. (Part 11 audit trail IP 요건)
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

describe("§11.345-B2 — 발주 라우트 IP 보강", () => {
  it("orders/[id]/route: auditRequestMeta(request) 캡처", () => {
    const src = read("src/app/api/orders/[id]/route.ts");
    expect(src).toContain("auditRequestMeta");
    expect(src).toContain("auditRequestMeta(request)");
  });

  it("orders/[id]/send-email: POST(request) + auditRequestMeta", () => {
    const src = read("src/app/api/orders/[id]/send-email/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).not.toContain("_request: NextRequest");
  });

  it("orders/[id]/generate-pdf: POST(request) + auditRequestMeta, PO_PDF_GENERATED 보존", () => {
    const src = read("src/app/api/orders/[id]/generate-pdf/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).not.toContain("_request: NextRequest");
    expect(src).toContain("PO_PDF_GENERATED");
  });
});
