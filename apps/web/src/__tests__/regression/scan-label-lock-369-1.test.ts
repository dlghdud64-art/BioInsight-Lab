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

  it("sensitive_data_import action / inventory targetEntityType 보존", () => {
    const src = read(ROUTE);
    expect(src).toContain("action: 'sensitive_data_import'");
    expect(src).toContain("targetEntityType: 'inventory'");
  });
});
