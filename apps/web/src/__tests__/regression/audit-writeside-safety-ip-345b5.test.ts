/**
 * §11.345-B5 (회귀) — safety 라우트 write단 IP 보강 sentinel (long-tail 최종)
 *
 * 안전/지출 조회·매핑 감사 이벤트의 IP 캡처. 동적 import 에 auditRequestMeta 포함 확인.
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

describe("§11.345-B5 — safety 라우트 IP 보강", () => {
  it("safety-spend (view_summary): auditRequestMeta(request)", () => {
    const src = read("src/app/api/safety-spend/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).toContain("createAuditLog, auditRequestMeta");
  });

  it("safety/spend/map (purchase_manual_map): auditRequestMeta(request)", () => {
    const src = read("src/app/api/safety/spend/map/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });

  it("safety/spend/summary (safety_spend_view): auditRequestMeta(request)", () => {
    const src = read("src/app/api/safety/spend/summary/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });
});
