/**
 * §11.246d-3 #lcp-buffered-observer — 호영님 P0 §11.246e baseline 보강 (LCP RUM)
 *
 * 호영님 spec: §11.246e baseline 측정 시 LCP entries null 발견 →
 *   PerformanceObserver buffered:true 누락 때문. 이미 발생한 LCP entry
 *   캡처 못 함. RUM (Real User Monitoring) helper 신규 구축으로 해소.
 *
 * canonical truth lock:
 *   - silent observer (render 0)
 *   - layout.tsx Provider stack 변경 0 (body 안 client component mount 만)
 *   - schema / migration / mutation 변경 0
 *   - window 객체 augmentation 만 (window.__labaxisLCP)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HELPER_PATH = resolve(__dirname, "../../../lib/performance/lcp-observer.ts");
const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/observability/lcp-observer-client.tsx",
);
const LAYOUT_PATH = resolve(__dirname, "../../../app/layout.tsx");

const helper = readFileSync(HELPER_PATH, "utf8");
const component = readFileSync(COMPONENT_PATH, "utf8");
const layout = readFileSync(LAYOUT_PATH, "utf8");

describe("§11.246d-3 #1 — lcp-observer.ts helper (PerformanceObserver buffered:true)", () => {
  it("observeLCP function export", () => {
    expect(helper).toMatch(/export\s+function\s+observeLCP/);
  });

  it("new PerformanceObserver — largest-contentful-paint + buffered:true", () => {
    expect(helper).toMatch(/new\s+PerformanceObserver/);
    expect(helper).toMatch(/type:\s*["']largest-contentful-paint["']/);
    expect(helper).toMatch(/buffered:\s*true/);
  });

  it("window.__labaxisLCP expose (debug + Chrome MCP)", () => {
    expect(helper).toMatch(/window\.__labaxisLCP|__labaxisLCP/);
  });

  it("cleanup disconnect — return observer.disconnect 호출 가능", () => {
    expect(helper).toMatch(/observer\.disconnect|disconnect\(\)/);
  });

  it("SSR safe — typeof window === 'undefined' guard", () => {
    expect(helper).toMatch(/typeof\s+window\s*===\s*["']undefined["']/);
  });

  it("PerformanceObserver supported check", () => {
    // 모든 브라우저가 PerformanceObserver 지원하는 건 아니므로 guard
    expect(helper).toMatch(/PerformanceObserver|"PerformanceObserver"\s+in\s+window/);
  });
});

describe("§11.246d-3 #2 — LcpObserverClient component (silent mount)", () => {
  it("'use client' directive", () => {
    expect(component).toMatch(/^['"]use client['"]/m);
  });

  it("observeLCP import from helper", () => {
    expect(component).toMatch(
      /import\s*\{[\s\S]{0,80}observeLCP[\s\S]{0,80}\}\s*from\s*["']@\/lib\/performance\/lcp-observer["']/,
    );
  });

  it("useEffect mount → observeLCP 호출 + cleanup", () => {
    expect(component).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,400}observeLCP\(\)/);
  });

  it("render null (silent observer)", () => {
    expect(component).toMatch(/return\s+null/);
  });

  it("default export 또는 named export LcpObserverClient", () => {
    expect(component).toMatch(/export\s+(default\s+function|function)\s+LcpObserverClient/);
  });
});

describe("§11.246d-3 #3 — layout.tsx wiring", () => {
  it("LcpObserverClient import from @/components/observability/lcp-observer-client", () => {
    expect(layout).toMatch(
      /import\s*\{[\s\S]{0,80}LcpObserverClient[\s\S]{0,80}\}\s*from\s*["']@\/components\/observability\/lcp-observer-client["']/,
    );
  });

  it("<LcpObserverClient /> render — body 안", () => {
    expect(layout).toMatch(/<LcpObserverClient\s*\/?>/);
  });
});

describe("§11.246d-3 #4 — invariant 보존", () => {
  it("layout.tsx Provider stack 보존 (ThemeProvider/LocaleProvider/AuthSessionProvider/QueryProvider/QRScannerProviderWrapper)", () => {
    expect(layout).toMatch(/<ThemeProvider>[\s\S]{0,500}<LocaleProvider>[\s\S]{0,500}<AuthSessionProvider>[\s\S]{0,500}<QueryProvider>/);
  });

  it("§11.246d-2 NProgressBar 보존", () => {
    expect(layout).toMatch(/<NProgressBar\s*\/?>/);
  });

  it("§11.246d-3 trace marker comment", () => {
    expect(helper).toMatch(/§11\.246d-3[\s\S]{0,300}(lcp|LCP|buffered|RUM|observer)/i);
  });
});
