/**
 * §11.369-1 (회귀) — scan-label lock 버그 수정 sentinel
 *
 * 라이브 결함:
 *   1. targetEntityId: 'unknown' 하드코딩 → sensitive_data_import:unknown 단일 키
 *      cross-user/cross-item lock 409.
 *   2. enforcement.complete()/fail() 부재 → 성공 스캔마다 lock 5분 잔존, warm
 *      람다에서 후속 스캔 전부 409.
 *
 * Fix (apps/web/src/app/api/inventory/scan-label/route.ts):
 *   - L44 'unknown' → crypto.randomUUID() (요청별 유니크).
 *   - 성공 NextResponse return 직전 enforcement.complete().
 *   - catch 첫 줄 enforcement?.fail() (restock/route.ts 패턴 동일).
 *
 * 회귀 0: enforceAction wiring·deny() 분기·OCR 파이프라인·matchedProduct/Inventory·
 *   suggestions payload·세션 가드 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/inventory/scan-label/route.ts";

describe("§11.369-1 — scan-label lock 버그 수정", () => {
  it("targetEntityId: 'unknown' 하드코딩 제거 (cross-user lock 원인)", () => {
    const src = read(ROUTE);
    // enforceAction 블록 안에서만 'unknown' 미사용. (다른 위치 unknown 문자열은 무관)
    expect(src).not.toMatch(/targetEntityId:\s*['"]unknown['"]/);
  });

  it("targetEntityId 요청별 유니크 (crypto.randomUUID)", () => {
    const src = read(ROUTE);
    expect(src).toContain("targetEntityId: crypto.randomUUID()");
  });

  it("성공 경로 enforcement.complete() 호출 (5분 lock 잔존 차단)", () => {
    const src = read(ROUTE);
    expect(src).toContain("enforcement.complete()");
  });

  it("catch 경로 enforcement?.fail() 호출 (실패 lock 해제)", () => {
    const src = read(ROUTE);
    expect(src).toContain("enforcement?.fail()");
  });
});

describe("§11.369-1 — 회귀 0 (기존 동작 보존)", () => {
  it("enforceAction wiring + deny 분기 보존", () => {
    const src = read(ROUTE);
    expect(src).toContain("enforcement = enforceAction(");
    expect(src).toContain("if (!enforcement.allowed) return enforcement.deny();");
  });

  it("enforceAction canonical action / inventory targetEntityType 보존 (§scan-role-scope 진화: 단건 → inventory_create)", () => {
    const src = read(ROUTE);
    // §scan-role-scope (호영님 2026-06-16): 단건 라벨 스캔 action 을 sensitive_data_import(buyer/
    //   ops_admin) → inventory_create(requester 허용)로 하향. §11.369-1 보호 의도(lock 버그 수정:
    //   uuid+complete/fail+enforceAction wiring)는 무관·유지. 여기선 enforceAction 이 canonical action
    //   으로 배선되고 targetEntityType 가 inventory 임만 확인(구체 action 값은 scope 트랙 소관).
    expect(src).toContain("action: 'inventory_create'");
    expect(src).not.toContain("action: 'sensitive_data_import'"); // 단건 경로 sensitive 미사용(대량은 별 route)
    expect(src).toContain("targetEntityType: 'inventory'");
  });
});
