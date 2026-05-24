/**
 * §11.293 #vendor-dispatch-toggle-reset-fix — 호영님 P0 sentinel.
 *
 * 호영님 P0 (2026-05-24):
 *   견적 관리 → "공급사 발송 검토" 모달에서 공급사 후보 7개 전부 체크
 *   상태 + 선택 해제 불가 (toggle 직후 즉시 reset 회귀).
 *
 * Root cause (Phase 0 audit):
 *   vendor-dispatch-workbench.tsx line 135-160 의 useEffect dependency 가
 *   [open, resolvedSuppliersInput, draftMessageInput, trackingStorageKey].
 *   parent component 가 resolvedSuppliersInput 을 새 reference 로 전달
 *   할 때마다 setSuppliers(resolvedSuppliersInput) 호출 → 사용자 toggle
 *   후 즉시 reset = 호영님 spec Case C (state 강제 재설정).
 *
 * Fix:
 *   wasOpenRef ref 추가 → open === false → true 전환 시에만 init 실행,
 *   open 이 이미 true 인 상태에서 prop reference 변경은 무시.
 *   toggleSupplier / sendReadiness / includedCount UI 동적 메시지 wiring
 *   은 이미 정상 (회귀 0, dependency 만 손봄).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(
    __dirname,
    "../../components/quotes/dispatch/vendor-dispatch-workbench.tsx",
  ),
  "utf8",
);

describe("§11.293 — 공급사 발송 검토 모달 toggle reset 버그 fix", () => {
  it("§11.293 trace marker + vendor-dispatch-toggle-reset-fix comment", () => {
    expect(SRC).toMatch(/§11\.293/);
    expect(SRC).toMatch(/vendor-dispatch-toggle-reset-fix/);
  });

  it("wasOpenRef useRef 추가 — open 전환 detection guard", () => {
    expect(SRC).toMatch(/const wasOpenRef = useRef\(false\)/);
  });

  it("init useEffect 안에서 wasOpen guard — 이미 열린 상태 prop 변경 무시", () => {
    // wasOpenRef.current 를 wasOpen 으로 capture
    expect(SRC).toMatch(/const wasOpen = wasOpenRef\.current/);
    // wasOpenRef.current = open 으로 update
    expect(SRC).toMatch(/wasOpenRef\.current = open/);
    // if (wasOpen) return guard
    expect(SRC).toMatch(/if \(wasOpen\) return/);
  });

  it("기존 setSuppliers(resolvedSuppliersInput) init 로직 보존 (open false→true 시만)", () => {
    expect(SRC).toMatch(/setSuppliers\(resolvedSuppliersInput\)/);
    expect(SRC).toMatch(/resolvedSuppliersInput\.length > 0/);
  });

  it("기존 toggleSupplier callback 보존 (회귀 0)", () => {
    expect(SRC).toMatch(
      /toggleSupplier\s*=\s*useCallback\(\(vendorId: string\)\s*=>/,
    );
    expect(SRC).toMatch(/included:\s*!s\.included/);
  });

  it("기존 sendReadiness + includedCount UI 동적 메시지 보존", () => {
    expect(SRC).toMatch(/const includedCount = includedSuppliers\.length/);
    expect(SRC).toMatch(/supplierOk = includedCount > 0/);
    expect(SRC).toMatch(/공급사 \{includedCount\}곳 선택됨/);
  });

  it("기존 message / manual fallback / sentTracking init 로직 보존", () => {
    expect(SRC).toMatch(/setMessage\(draftMessageInput \|\| ""\)/);
    expect(SRC).toMatch(/setShowManualFallback\(false\)/);
    expect(SRC).toMatch(/setSentTracking\(/);
  });
});
