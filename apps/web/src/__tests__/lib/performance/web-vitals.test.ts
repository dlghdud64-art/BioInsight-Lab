/**
 * §11.246d-5 #web-vitals-cls-fid-inp — §11.246d-3 LCP observer 자연 속편 (FID/CLS/INP)
 *
 * 호영님 spec: Core Web Vitals 4 metric 완제 (LCP §11.246d-3 + CLS + FID + INP)
 *   - CLS (Cumulative Layout Shift) — layout-shift entry 누적 합산
 *   - FID (First Input Delay) — first-input entry (legacy, INP 으로 대체 중)
 *   - INP (Interaction to Next Paint) — event entry duration 최대값 (web-vitals 권장)
 *
 * canonical truth lock:
 *   - 기존 §11.246d-3 observeLCP() 시그니처 보존
 *   - window.__labaxisLCP 보존 + window.__labaxisCLS / __labaxisFID / __labaxisINP 추가
 *   - LcpObserverClient 시그니처 변경 0 (caller drift 0)
 *   - silent observer 패턴 (render 0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HELPER_PATH = resolve(__dirname, "../../../lib/performance/lcp-observer.ts");
const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/observability/lcp-observer-client.tsx",
);

const helper = readFileSync(HELPER_PATH, "utf8");
const component = readFileSync(COMPONENT_PATH, "utf8");

describe("§11.246d-5 #1 — observeCLS (Cumulative Layout Shift)", () => {
  it("observeCLS function export", () => {
    expect(helper).toMatch(/export\s+function\s+observeCLS/);
  });

  it("PerformanceObserver type:'layout-shift' + buffered:true", () => {
    expect(helper).toMatch(
      /type:\s*["']layout-shift["'][\s\S]{0,200}buffered:\s*true|buffered:\s*true[\s\S]{0,200}type:\s*["']layout-shift["']/,
    );
  });

  it("CLS 누적 합산 — hadRecentInput 분기 (user input 제외)", () => {
    // W3C CLS spec: hadRecentInput=true entry 는 제외 (사용자 의도적 input 으로 인한 shift)
    expect(helper).toMatch(/hadRecentInput/);
  });

  it("window.__labaxisCLS expose", () => {
    expect(helper).toMatch(/__labaxisCLS/);
  });
});

describe("§11.246d-5 #2 — observeFID (First Input Delay)", () => {
  it("observeFID function export", () => {
    expect(helper).toMatch(/export\s+function\s+observeFID/);
  });

  it("PerformanceObserver type:'first-input' + buffered:true", () => {
    expect(helper).toMatch(
      /type:\s*["']first-input["'][\s\S]{0,200}buffered:\s*true|buffered:\s*true[\s\S]{0,200}type:\s*["']first-input["']/,
    );
  });

  it("FID = processingStart - startTime (input delay)", () => {
    expect(helper).toMatch(/processingStart\s*-\s*startTime|processingStart\s*-\s*\w+\.startTime/);
  });

  it("window.__labaxisFID expose", () => {
    expect(helper).toMatch(/__labaxisFID/);
  });
});

describe("§11.246d-5 #3 — observeINP (Interaction to Next Paint)", () => {
  it("observeINP function export", () => {
    expect(helper).toMatch(/export\s+function\s+observeINP/);
  });

  it("PerformanceObserver type:'event' + buffered:true", () => {
    expect(helper).toMatch(
      /type:\s*["']event["'][\s\S]{0,300}buffered:\s*true|buffered:\s*true[\s\S]{0,300}type:\s*["']event["']/,
    );
  });

  it("INP = event duration 최대값 (interaction latency)", () => {
    // duration field 사용 + Math.max 또는 maxDuration 추적
    expect(helper).toMatch(/\.duration[\s\S]{0,400}(Math\.max|maxDuration|maxINP)/);
  });

  it("window.__labaxisINP expose", () => {
    expect(helper).toMatch(/__labaxisINP/);
  });
});

describe("§11.246d-5 #4 — LcpObserverClient 3 observer 호출 확장", () => {
  it("observeCLS / observeFID / observeINP import", () => {
    expect(component).toMatch(/observeCLS/);
    expect(component).toMatch(/observeFID/);
    expect(component).toMatch(/observeINP/);
  });

  it("useEffect mount 시 4 observer 모두 호출 + cleanup", () => {
    // observeCLS() / observeFID() / observeINP() 호출 + cleanup return
    expect(component).toMatch(/observeCLS\(\)/);
    expect(component).toMatch(/observeFID\(\)/);
    expect(component).toMatch(/observeINP\(\)/);
  });
});

describe("§11.246d-5 #5 — invariant 보존", () => {
  it("§11.246d-3 observeLCP function 보존", () => {
    expect(helper).toMatch(/export\s+function\s+observeLCP/);
  });

  it("§11.246d-3 window.__labaxisLCP 보존", () => {
    expect(helper).toMatch(/__labaxisLCP/);
  });

  it("§11.246d-3 PerformanceObserver largest-contentful-paint 보존", () => {
    expect(helper).toMatch(/largest-contentful-paint/);
  });

  it("LcpObserverClient 'use client' + render null 보존", () => {
    expect(component).toMatch(/^['"]use client['"]/m);
    expect(component).toMatch(/return\s+null/);
  });

  it("§11.246d-5 trace marker comment", () => {
    expect(helper).toMatch(/§11\.246d-5[\s\S]{0,300}(CLS|FID|INP|web.vitals|core.web)/i);
  });
});
