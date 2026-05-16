/**
 * §11.250f #budget-warning-notification-dispatch — P1 마지막 cluster (BUDGET_WARNING).
 *
 * 호영님 spec: request/approve route 안 validateCategoryBudgetInTransaction
 *   warnings (level "warning" 또는 "soft_limit") 발생 시 BUDGET_WARNING dispatch + push.
 *   recipient = purchaseRequest.requesterId. mobile system fallback (/(tabs)).
 *   organizationMember admin broadcast 별도 cluster.
 *
 * Strategy:
 *   - 트랜잭션 종료 후 budgetWarnings.length > 0 분기.
 *   - dispatch BUDGET_WARNING + entityType "BUDGET" + entityId requestId.
 *   - push type "system" reuse (mobile budget detail surface 없음).
 *   - hard_stop 은 BudgetBlockedError → 차단됨 (별도 path). warning + soft_limit 만 알림.
 *   - try/catch graceful.
 *
 * canonical truth lock:
 *   - BUDGET_WARNING event-type 이미 등록 (entityType "BUDGET", defaultActions [IN_APP, QUEUE_ITEM]).
 *   - validateCategoryBudgetInTransaction warning/soft_limit/hard_stop level 보존.
 *   - §11.229b-5/-6 + §11.250a/cd/b/g/e 패턴 정확 reuse.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/request/[id]/approve/route.ts",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);
const GATE_PATH = resolve(
  __dirname,
  "../../../lib/budget/category-budget-gate.ts",
);

const route = safeRead(ROUTE_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);
const gate = safeRead(GATE_PATH);

describe("§11.250f #1 — request/approve route BUDGET_WARNING dispatch", () => {
  it("dispatchNotificationEvent import 확인 (기존 import 또는 추가)", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
  });

  it("BUDGET_WARNING eventType 호출 (literal)", () => {
    expect(route).toMatch(/eventType[:\s]+["']BUDGET_WARNING["']/);
  });

  it("entityType BUDGET 정합 (BUDGET_WARNING block)", () => {
    expect(route).toMatch(/BUDGET_WARNING[\s\S]{0,800}entityType[:\s]+["']BUDGET["']/);
  });

  it("entityId requestId forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1200}entityId[:\s]+(requestId|purchaseRequest\.id)/);
  });

  it("recipients purchaseRequest.requesterId forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1500}recipients[\s\S]{0,500}requesterId/);
  });

  it("metadata budgetWarnings 정보 포함 (categoryDisplayName / projectedUsagePercent / level)", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,2500}metadata[\s\S]{0,800}(warning|category|usage|percent|level)/);
  });
});

describe("§11.250f #2 — push notification (system type reuse)", () => {
  it("sendPushNotification 호출 — requesterId forward", () => {
    expect(route).toMatch(/sendPushNotification\s*\(\s*(\w+\.)*requesterId/);
  });

  it("push payload type 'system' (mobile ROUTE_MAP fallback)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']system["']/);
  });

  it("push title 한국어 (예산 또는 경고) — BUDGET 인접", () => {
    expect(route).toMatch(/BUDGET_WARNING[\s\S]{0,3500}title[\s\S]{0,200}(예산|경고)/);
  });
});

describe("§11.250f #3 — warning detection (warnings.length > 0)", () => {
  it("budgetWarnings 변수 + length check", () => {
    expect(route).toMatch(/budgetWarnings/);
    expect(route).toMatch(/budgetWarnings[\s\S]{0,200}length/);
  });

  it("requester userId null check (guest skip)", () => {
    expect(route).toMatch(/(purchaseRequest|request)\.requesterId/);
  });
});

describe("§11.250f #4 — graceful try/catch (mutation 정합 보호)", () => {
  it("BUDGET_WARNING dispatch try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,2000}BUDGET_WARNING[\s\S]{0,2000}\}\s*catch/);
  });

  it("sendPushNotification try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,2500}sendPushNotification[\s\S]{0,2500}\}\s*catch/);
  });
});

describe("§11.250f #5 — 기존 approve flow 보존 (invariant)", () => {
  it("validateCategoryBudgetInTransaction 보존", () => {
    expect(route).toMatch(/validateCategoryBudgetInTransaction/);
  });

  it("BudgetBlockedError 보존 (hard_stop)", () => {
    expect(route).toMatch(/BudgetBlockedError/);
  });

  it("PurchaseRequestStatus.APPROVED update 보존", () => {
    expect(route).toMatch(/PurchaseRequestStatus\.APPROVED/);
  });

  it("기존 PURCHASE_APPROVED dispatch 보존 (별도 cluster)", () => {
    expect(route).toMatch(/PURCHASE_APPROVED/);
  });
});

describe("§11.250f #6 — invariant 보존 (cross-stack)", () => {
  it("BUDGET_WARNING event-type 정의 보존 (entityType BUDGET)", () => {
    expect(eventTypes).toMatch(/BUDGET_WARNING[\s\S]{0,400}entityType[:\s]+["']BUDGET["']/);
  });

  it("BUDGET_WARNING defaultActions IN_APP + QUEUE_ITEM 보존", () => {
    expect(eventTypes).toMatch(/BUDGET_WARNING[\s\S]{0,500}IN_APP/);
    expect(eventTypes).toMatch(/BUDGET_WARNING[\s\S]{0,500}QUEUE_ITEM/);
  });

  it("category-budget-gate warning/soft_limit/hard_stop level 보존", () => {
    expect(gate).toMatch(/warningPercent/);
    expect(gate).toMatch(/softLimitPercent/);
    expect(gate).toMatch(/hardStopPercent/);
  });

  it("§11.250f trace marker", () => {
    expect(route).toMatch(/§11\.250f|11\.250f/);
  });
});
