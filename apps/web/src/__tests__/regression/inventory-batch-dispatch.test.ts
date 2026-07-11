/**
 * #inventory-batch-dispatch (RED -> GREEN) — 다건 lot 원자적 배치출고.
 *
 * P5 overlay 의 정직-disabled 일괄출고를 실배선으로 해제.
 * 핵심: 단일 $transaction all-or-nothing(부분 출고 = GMP truth 위반, 금지).
 *   - 어느 item 하나라도 실패(재고부족/GMP 누락/권한/미존재) → 전체 롤백, write 0.
 *   - per-item GMP 게이트(validateUsageForTrackingMode) · InventoryUsage(DISPATCH) · audit (tx 내).
 *   - overlay 일괄출고 버튼 enabled → 배치 sheet → mutation → invalidate.
 *   - GMP 필드(destination/operator) = 배치 공유 1값(호영님 2026-07-10 결정 a).
 *
 * ⛔ 금지: N회 반복 단건 호출(원자성 없음) · 부분 성공 UX · placeholder success.
 *
 * Phase 1 기대: 라우트/UI/overlay wiring 부재 = RED. Phase 2/3 구현 시 GREEN.
 *
 * 구현 앵커(Phase 2/3):
 *  - 라우트: src/app/api/inventory/dispatch-batch/route.ts — POST, zod items[], 단일 db.$transaction,
 *    items 순회, validateUsageForTrackingMode, InventoryUsage type DISPATCH, createAuditLog, enforceAction.
 *  - UI: src/components/inventory/lot-batch-dispatch-sheet.tsx
 *  - overlay(inventory-content): data-lot-bulk-dispatch-disabled 제거 + 배치 sheet 오픈 wiring.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => (existsSync(join(WEB, rel)) ? readFileSync(join(WEB, rel), "utf8") : "");
const exists = (rel: string): boolean => existsSync(join(WEB, rel));

const ROUTE = "src/app/api/inventory/dispatch-batch/route.ts";
const SHEET = "src/components/inventory/lot-batch-dispatch-sheet.tsx";
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("#inventory-batch-dispatch — 원자적 배치 라우트 (RED)", () => {
  it("dispatch-batch route 존재", () => {
    expect(exists(ROUTE)).toBe(true);
  });
  it("POST 핸들러", () => {
    expect(read(ROUTE)).toMatch(/export async function POST/);
  });
  it("zod items 배열 스키마", () => {
    const s = read(ROUTE);
    expect(s).toMatch(/items/);
    expect(s).toMatch(/z\.array/);
  });
  it("단일 $transaction (all-or-nothing 원자성)", () => {
    expect(read(ROUTE)).toMatch(/\$transaction/);
  });
  it("per-item GMP 게이트 재사용", () => {
    expect(read(ROUTE)).toContain("validateUsageForTrackingMode");
  });
  it("InventoryUsage DISPATCH 생성 + audit + enforceAction", () => {
    const s = read(ROUTE);
    expect(s).toMatch(/inventoryUsage\.create/);
    expect(s).toMatch(/DISPATCH/);
    expect(s).toContain("createAuditLog");
    expect(s).toContain("enforceAction");
  });
  it("비원자 N회 반복(단건 route fetch) 금지", () => {
    // 배치 route 안에서 /use 단건 route 를 반복 호출하는 안티패턴 금지
    expect(read(ROUTE)).not.toMatch(/\/use['"`]/);
  });
});

describe("#inventory-batch-dispatch — 배치 sheet UI (RED)", () => {
  it("lot-batch-dispatch-sheet 컴포넌트 존재", () => {
    expect(exists(SHEET)).toBe(true);
  });
  it("선택 lot별 수량 입력 + 공유 destination/operator", () => {
    const s = read(SHEET);
    expect(s).toMatch(/destination/);
    expect(s).toMatch(/operator/);
  });
});

describe("#inventory-batch-dispatch — 런타임 결함 가드 (operator 게이트 2건, 호영님 2026-07-10)", () => {
  it("재고 초과 출고 pre-flight 거부(음수 재고 방지 — GMP 무결성)", () => {
    const s = read(ROUTE);
    expect(s).toMatch(/item\.quantity\s*>\s*inv\.currentQuantity/);
  });
  it("클라이언트 = csrfFetch(전역 CSRF 게이트 — 403 방지). raw fetch 금지", () => {
    const s = read(SHEET);
    expect(s).toMatch(/csrfFetch\("\/api\/inventory\/dispatch-batch"/);
    expect(s).not.toMatch(/[^f]fetch\("\/api\/inventory\/dispatch-batch"/);
  });
});

describe("#inventory-batch-dispatch — overlay 일괄출고 실배선 (RED)", () => {
  it("일괄출고 정직-disabled 마커 제거(enabled 전환)", () => {
    expect(read(CONTENT)).not.toContain("data-lot-bulk-dispatch-disabled");
  });
  it("배치 sheet 오픈 wiring", () => {
    expect(read(CONTENT)).toContain("lot-batch-dispatch");
  });
});
