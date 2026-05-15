/**
 * §11.246d-4 #rum-server-post-endpoint — 호영님 P0 §11.246d-3/-5 자연 후속
 *
 * 호영님 spec: §11.246d-3 LCP + §11.246d-5 CLS/FID/INP client RUM 측정 → server
 *   POST endpoint 으로 전송 + structured log. DB persistence 는 후속 cluster
 *   (§11.246d-4-cont) 백로그 — initial scope = structured logging only.
 *
 * Strategy:
 *   - POST /api/analytics/rum route (zod validation)
 *   - 4 metric 모두 optional (browser 미지원 환경 graceful fallback)
 *   - client side navigator.sendBeacon (page unload 시) — unobtrusive
 *
 * canonical truth lock:
 *   - schema 변경 0 (initial scope = logging only)
 *   - 기존 §11.246d-3/-5 client observer 시그니처 보존
 *   - server route stand-alone (다른 endpoint 영향 0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/analytics/rum/route.ts",
);
const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/observability/lcp-observer-client.tsx",
);
const HELPER_PATH = resolve(__dirname, "../../../lib/performance/lcp-observer.ts");

const route = readFileSync(ROUTE_PATH, "utf8");
const component = readFileSync(COMPONENT_PATH, "utf8");
const helper = readFileSync(HELPER_PATH, "utf8");

describe("§11.246d-4 #1 — POST /api/analytics/rum route", () => {
  it("POST handler export", () => {
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("zod schema — 4 metric optional (lcp/cls/fid/inp)", () => {
    expect(route).toMatch(/lcp:\s*z\.[^,]+optional/);
    expect(route).toMatch(/cls:\s*z\.[^,]+optional/);
    expect(route).toMatch(/fid:\s*z\.[^,]+optional/);
    expect(route).toMatch(/inp:\s*z\.[^,]+optional/);
  });

  it("zod safeParse + 400 invalid response", () => {
    expect(route).toMatch(/safeParse/);
    expect(route).toMatch(/status:\s*400/);
  });

  it("structured log (console.log 또는 logger)", () => {
    expect(route).toMatch(/(console\.log|logger\.info|console\.info)[\s\S]{0,200}rum|RUM/);
  });

  it("200 또는 204 success response", () => {
    expect(route).toMatch(/status:\s*(200|204)/);
  });
});

describe("§11.246d-4 #2 — client side beacon (navigator.sendBeacon)", () => {
  it("LcpObserverClient 안 navigator.sendBeacon 호출", () => {
    expect(component).toMatch(/navigator\.sendBeacon|sendBeacon/);
  });

  it("page unload 또는 visibilitychange 시점 beacon 발화", () => {
    expect(component).toMatch(/(beforeunload|visibilitychange|pagehide)/);
  });

  it("RUM endpoint URL /api/analytics/rum", () => {
    expect(component).toMatch(/\/api\/analytics\/rum/);
  });
});

describe("§11.246d-4 #3 — invariant 보존", () => {
  it("§11.246d-3 observeLCP 보존", () => {
    expect(helper).toMatch(/export\s+function\s+observeLCP/);
  });

  it("§11.246d-5 observeCLS / observeFID / observeINP 보존", () => {
    expect(helper).toMatch(/export\s+function\s+observeCLS/);
    expect(helper).toMatch(/export\s+function\s+observeFID/);
    expect(helper).toMatch(/export\s+function\s+observeINP/);
  });

  it("LcpObserverClient 'use client' + return null + 4 observer 호출 보존", () => {
    expect(component).toMatch(/^['"]use client['"]/m);
    expect(component).toMatch(/return\s+null/);
    expect(component).toMatch(/observeLCP\(\)/);
    expect(component).toMatch(/observeCLS\(\)/);
  });

  it("§11.246d-4 trace marker comment", () => {
    expect(route).toMatch(/§11\.246d-4[\s\S]{0,300}(rum|RUM|beacon|web.vitals)/i);
  });
});
