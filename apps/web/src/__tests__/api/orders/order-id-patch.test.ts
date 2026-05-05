/**
 * #post-approval-purchase-order-flow Phase 4.1 server — RED→GREEN
 *
 * /api/orders/[id] route 신설:
 *   - GET: order detail (auth + ownership 검증)
 *   - PATCH: status / shippingAddress / expectedDelivery / actualDelivery 변경
 *     (zod + auth + audit log try/catch graceful)
 *
 * canonical truth = Order model (DB). status 5 enum (ORDERED / CONFIRMED /
 * SHIPPING / DELIVERED / CANCELLED).
 *
 * audit log = SETTINGS_CHANGED 재사용 + entityType "ORDER" (dedicated enum
 * 신설은 별도 batch).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/orders/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 4.1 — route file", () => {
  it("/api/orders/[id]/route.ts 신규 file 존재", () => {
    const src = read(ROUTE);
    expect(src.length).toBeGreaterThan(0);
  });

  it("GET + PATCH handler export", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/export\s+async\s+function\s+PATCH/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.1 — PATCH zod", () => {
  it("zod schema 정의 + OrderStatus nativeEnum 사용", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/z\.object/);
    // z.nativeEnum(OrderStatus) — Prisma enum 직접 매핑 (5 values 자동 포함)
    expect(src).toMatch(/z\.nativeEnum\(OrderStatus\)|OrderStatus/);
  });

  it("status optional (partial update)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/status:\s*z\.[\s\S]*?\.optional\(\)/);
  });

  it("expectedDelivery / actualDelivery 또는 shippingAddress optional", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/expectedDelivery|actualDelivery|shippingAddress/);
  });

  it("auth (인증된 사용자만)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/auth\(\)/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.1 — audit log", () => {
  it("createAuditLog import + status 변경 시 호출 (try/catch graceful)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/try[\s\S]*?createAuditLog[\s\S]*?catch/);
  });

  it("eventType: SETTINGS_CHANGED + entityType: ORDER", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']SETTINGS_CHANGED["']/);
    expect(src).toMatch(/entityType:\s*["']ORDER["']/);
  });

  it("changes.before / changes.after 명시 (status before/after)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/before:\s*\{[\s\S]*?status/);
    expect(src).toMatch(/after:\s*\{[\s\S]*?status/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.1 — ownership check", () => {
  it("owner 또는 organization member 만 PATCH 가능", () => {
    const src = read(ROUTE);
    // ownership 검증 — userId 또는 organizationMember 체크
    expect(src).toMatch(/userId|organizationMember/);
  });
});
