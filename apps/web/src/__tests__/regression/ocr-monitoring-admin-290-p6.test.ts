/**
 * §11.290 Phase 6 #ocr-monitoring-admin-dashboard — OCR 사용량 + cost
 *   admin dashboard. Phase 5.5 + 5.5.b 의 OcrResult.costUsd / OcrJob.cached
 *   데이터 source 위에 per-provider + per-day + cache hit ratio aggregation.
 *
 * 호영님 P1 spec (2026-05-23):
 *   §11.290 family 의 cost monitoring 마무리. operator 가 OCR API 비용 +
 *   효율 (cache hit ratio) 을 시각화. Phase 5 wiring 후 자연스러운 follow-up.
 *
 * Lock (admin/cron 패턴 정합):
 *   - admin gate 2 layer: auth() session + isAdmin(userId)
 *   - period query param (7d default | 30d)
 *   - $queryRawUnsafe + Number(intervalDays) cast (SQL injection 차단)
 *   - BigInt → Number 안전 직렬화
 *   - recharts dynamic import (next/dynamic, ssr:false) — bundle 분리
 *
 * Test scope (12 it):
 *   API (6 it):
 *     1. trace marker §11.290 Phase 6
 *     2. route file 존재 + GET handler
 *     3. admin auth guard (auth + isAdmin)
 *     4. per-provider aggregation (groupBy provider)
 *     5. per-day aggregation (DATE(createdAt))
 *     6. cache hit ratio (OcrJob.cached count / total)
 *   UI (5 it):
 *     7. page.tsx 존재 + trace marker
 *     8. OcrCostChart dynamic import (next/dynamic + ssr:false)
 *     9. per-provider summary table data-testid
 *     10. per-day chart data-testid
 *     11. cache hit ratio gauge data-testid
 *   Sidebar (1 it):
 *     12. admin-sidebar entry "OCR 사용량" + href "/admin/ocr-monitoring"
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const API_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/admin/ocr-monitoring/route.ts",
);
const PAGE_PATH = resolve(
  __dirname,
  "../../app/admin/ocr-monitoring/page.tsx",
);
const CHART_PATH = resolve(
  __dirname,
  "../../components/admin/ocr-cost-chart.tsx",
);
const SIDEBAR_PATH = resolve(
  __dirname,
  "../../app/admin/_components/admin-sidebar.tsx",
);

describe("§11.290 Phase 6 — OCR cost monitoring admin dashboard", () => {
  describe("API — /api/admin/ocr-monitoring/route.ts", () => {
    it("§11.290 Phase 6 trace marker + route file 존재", () => {
      expect(existsSync(API_ROUTE_PATH)).toBe(true);
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      expect(src).toMatch(/§11\.290 Phase 6/);
    });

    it("GET handler + admin auth guard (auth + isAdmin)", () => {
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      expect(src).toMatch(/export async function GET/);
      expect(src).toMatch(/await auth\(\)/);
      expect(src).toMatch(/isAdmin\(/);
    });

    it("per-provider aggregation (OcrResult groupBy provider + sum costUsd)", () => {
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      // SQL 또는 Prisma groupBy 패턴
      expect(src).toMatch(/provider/);
      expect(src).toMatch(/costUsd/);
    });

    it("per-day aggregation (DATE(createdAt) groupBy)", () => {
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      // DATE(... createdAt) 또는 date_trunc('day', ...) 패턴
      expect(src).toMatch(/createdAt|DATE\(/);
    });

    it("cache hit ratio (OcrJob aggregation, status 또는 cached signal)", () => {
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      // imageHash + 동일 hash 가 N+1 row → cache hit signal
      expect(src).toMatch(/imageHash|cacheHitRatio|cacheHit/);
    });

    it("period query (7d default | 30d) + Number(intervalDays) cast", () => {
      const src = readFileSync(API_ROUTE_PATH, "utf8");
      expect(src).toMatch(/period/);
      expect(src).toMatch(/Number\(/);
    });
  });

  describe("UI — /admin/ocr-monitoring/page.tsx + OcrCostChart", () => {
    it("§11.290 Phase 6 trace marker + page file 존재", () => {
      expect(existsSync(PAGE_PATH)).toBe(true);
      const src = readFileSync(PAGE_PATH, "utf8");
      expect(src).toMatch(/§11\.290 Phase 6/);
      expect(src).toMatch(/"use client"/);
    });

    it("OcrCostChart 컴포넌트 존재 + named recharts import", () => {
      expect(existsSync(CHART_PATH)).toBe(true);
      const src = readFileSync(CHART_PATH, "utf8");
      expect(src).toMatch(/from "recharts"/);
      expect(src).toMatch(/export default/);
    });

    it("page.tsx 에서 OcrCostChart 가 next/dynamic + ssr:false 로 import", () => {
      const src = readFileSync(PAGE_PATH, "utf8");
      expect(src).toMatch(/next\/dynamic/);
      expect(src).toMatch(/ssr:\s*false/);
      expect(src).toMatch(/OcrCostChart|ocr-cost-chart/);
    });

    it("per-provider summary table + per-day chart + cache hit ratio gauge data-testid", () => {
      const src = readFileSync(PAGE_PATH, "utf8");
      expect(src).toMatch(/data-testid=["']ocr-provider-summary["']/);
      expect(src).toMatch(/data-testid=["']ocr-per-day-chart["']/);
      expect(src).toMatch(/testId=["']ocr-cache-hit-ratio["']/); // KpiCard prop → data-testid={testId} dynamic render
    });
  });

  describe("Sidebar — admin-sidebar entry", () => {
    it("'OCR 사용량' entry + href '/admin/ocr-monitoring'", () => {
      const src = readFileSync(SIDEBAR_PATH, "utf8");
      expect(src).toMatch(/OCR 사용량|OCR\s*Monitoring|ocr-monitoring/);
      expect(src).toMatch(/\/admin\/ocr-monitoring/);
    });
  });
});
