/**
 * §receiving-inspection-decision (T2) — 입고 검수 판정 sentinel.
 *
 * 문제(핸드오프 §0-3, release blocker): 검수 화면이 정적 표시물 — 라인별 판정 입력·수량 확인·
 *   불합격 처리 액션이 0. 현행 canonical 경로는 전량 승인/반려 2택뿐이다.
 *   (배선 자체는 존재: ReceivingReviewPanel → /api/receiving-drafts + approve|reject)
 *
 * 결정(PLAN_receiving-inspection-decision.md §0, 호영님 승인 2026-08-01):
 *   1. 검수 실측 수량 = `inspectedQuantity` 신설. 공급사 회신값(receivedQuantity)은 보존(GMP 추적성).
 *   2. 부분 입고 시 발주는 SHIPPING 유지 — 전량 입고 완료 시에만 DELIVERED. (OrderStatus enum 확장 별건)
 *   3. UI는 기존 검토 패널 내 확장(same-canvas, 신규 라우트 0 — 슬러그 충돌 리스크 회피).
 *   4. 이중입고 가드는 제거가 아니라 **라인 단위로 축소**(`restockedAt`) — 부분 입고 후 잔여 재확정 허용.
 *
 * canonical truth lock (회귀 0):
 *   - 재고 반영은 서버 트랜잭션 단일 경로. 합격 라인만 반영, 이미 반영된 라인 재반영 0.
 *   - 판정은 서버 저장 후 렌더(front-only 판정 금지).
 *   - 반려(reject) 흐름·ownership 게이트 보존.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = "prisma/schema.prisma";
const APPROVE = "src/app/api/receiving-drafts/[id]/approve/route.ts";
const INSPECT = "src/app/api/receiving-drafts/[id]/inspect/route.ts";
const PANEL = "src/components/receiving/receiving-review-panel.tsx";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const exists = (rel: string) => existsSync(resolve(process.cwd(), rel));

describe("§receiving-inspection-decision P2 — 스키마", () => {
  it("ReceivingDraftItem 에 판정·실측·불일치 필드 추가", () => {
    const s = read(SCHEMA);
    const model = s.slice(s.indexOf("model ReceivingDraftItem "), s.indexOf("model ReceivingDraftItem ") + 2000);
    expect(model).toMatch(/inspectedQuantity/);
    expect(model).toMatch(/decision/);
    expect(model).toMatch(/decidedAt/);
    expect(model).toMatch(/discrepancyAction/);
    expect(model).toMatch(/discrepancyReason/);
    expect(model).toMatch(/restockedAt/); // 라인 단위 반영 가드
  });

  it("공급사 회신값(receivedQuantity) 보존 — 실측과 분리", () => {
    const s = read(SCHEMA);
    const model = s.slice(s.indexOf("model ReceivingDraftItem "), s.indexOf("model ReceivingDraftItem ") + 2000);
    expect(model).toMatch(/receivedQuantity/);
  });
});

describe("§receiving-inspection-decision P2 — 판정 저장 라우트", () => {
  it("라우트 존재 + ownership 게이트 + 읽기/쓰기 경계", () => {
    expect(exists(INSPECT)).toBe(true);
    const src = read(INSPECT);
    expect(src).toContain("auth()");
    expect(src).toMatch(/403/);
    expect(src).toMatch(/receivingDraftItem\.update|updateMany/);
  });

  it("임시 저장 — 판정 미완이어도 저장 가능(중간 이탈 안전)", () => {
    const src = read(INSPECT);
    expect(src).toMatch(/inspectedQuantity/);
    expect(src).toMatch(/decision/);
    expect(src).not.toMatch(/inventoryRestock\.create/); // 저장은 재고 반영과 분리
  });

  it("불일치 처리 3택 검증(재배송·부분입고·반품)", () => {
    const src = read(INSPECT);
    expect(src).toMatch(/RESHIP|재배송/);
    expect(src).toMatch(/PARTIAL|부분/);
    expect(src).toMatch(/RETURN|반품/);
  });
});

describe("§receiving-inspection-decision P2 — approve 개편", () => {
  it("합격(PASS) 라인만 재고 반영", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/decision/);
    expect(src).toMatch(/PASS/);
  });

  it("라인 단위 이중 반영 가드 — 이미 반영된 라인 제외", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/restockedAt/);
  });

  it("실측 수량 기준으로 반영(공급사 회신값 맹신 금지)", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/inspectedQuantity/);
  });

  it("전량 완료 시에만 DELIVERED — 부분은 SHIPPING 유지", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/DELIVERED/);
    expect(src).toMatch(/PARTIAL|allDone|isFullyReceived|remaining/);
  });

  it("회귀 0 — 트랜잭션·ownership·이중입고 방지 의도 보존", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/\$transaction/);
    expect(src).toMatch(/productInventory\.upsert/);
    expect(src).toMatch(/inventoryRestock\.create/);
    expect(src).toMatch(/restockSyncedAt|restockedAt/);
  });
});

describe("§receiving-inspection-decision P3 — 패널 UI", () => {
  it("6열 표 헤더(품목·Lot/유효기간·발주·수령·상태·판정)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/Lot/);
    expect(src).toMatch(/유효기간/);
    expect(src).toMatch(/발주/);
    expect(src).toMatch(/수령/);
    expect(src).toMatch(/상태/);
    expect(src).toMatch(/판정/);
  });

  it("진행률 N/M 판정", () => {
    const src = read(PANEL);
    expect(src).toMatch(/판정/);
    expect(src).toMatch(/decidedCount|진행률|\/\s*\{?총|N\/M|of/);
  });

  it("판정 완료 행 = 판정 취소만 노출", () => {
    const src = read(PANEL);
    expect(src).toMatch(/판정 취소/);
  });

  it("불일치 상태 파생 + 3택 + 사유 필수", () => {
    const src = read(PANEL);
    expect(src).toMatch(/불일치/);
    expect(src).toMatch(/재배송/);
    expect(src).toMatch(/부분 입고/);
    expect(src).toMatch(/반품/);
    expect(src).toMatch(/사유/);
  });

  it("푸터 — 임시 저장 + 완료 disabled + 남은 일(사유 없는 비활성 금지)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/임시 저장/);
    expect(src).toMatch(/재고 반영/);
    expect(src).toMatch(/남은 일/);
    expect(src).toMatch(/disabled/);
  });

  it("판정은 서버 저장 경유(front-only 금지)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/inspect/);
    expect(src).toMatch(/csrfFetch|fetch\(/);
  });

  it("§9 신호등 — amber/orange 0", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/\bamber-\d|\borange-\d/);
  });

  it("회귀 0 — 반려 흐름·패널 testid 보존", () => {
    const src = read(PANEL);
    expect(src).toContain('data-testid="receiving-review-panel"');
    expect(src).toMatch(/reject/);
  });
});
