/**
 * §11.345-B3 (회귀) — admin/users 클러스터 write단 IP 보강 sentinel
 *
 * 사용자 관리 변경(USER_CREATED/UPDATED/DELETED)은 Part 11 핵심 감사 이벤트.
 *   invite / approval / restore / [id] DELETE 의 createAuditLog 가
 *   auditRequestMeta(request) 로 IP/UA 를 캡처하는지 확인.
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

describe("§11.345-B3 — admin/users 라우트 IP 보강", () => {
  it("invite (POST user_invite): auditRequestMeta(request)", () => {
    const src = read("src/app/api/admin/users/invite/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });

  it("approval (POST manual_approval): IP + _request 제거", () => {
    const src = read("src/app/api/admin/users/[id]/approval/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).not.toContain("_request: NextRequest");
  });

  it("restore (POST user_restore): IP + _request 제거", () => {
    const src = read("src/app/api/admin/users/[id]/restore/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).not.toContain("_request: NextRequest");
  });

  it("[id] DELETE (user_reject): IP + _request 제거", () => {
    const src = read("src/app/api/admin/users/[id]/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
    expect(src).not.toContain("_request: NextRequest");
  });
});
