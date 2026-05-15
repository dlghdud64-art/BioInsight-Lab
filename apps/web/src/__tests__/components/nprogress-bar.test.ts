/**
 * §11.246d-2 #nprogress-page-transition — 호영님 P0 성능 #10 페이지 전환 NProgress 바
 *
 * 호영님 spec:
 *   - 페이지 navigation 시 상단 progress bar 노출 (다른 사이트들도 이런 UX 다 적용)
 *   - 사용자에게 "페이지가 전환되고 있다" 즉시 피드백 → "버튼 클릭이 안 됐나?" 의심 차단
 *
 * Scope:
 *   - next-nprogress-bar 라이브러리 (App Router 호환) 도입
 *   - LabAxis 브랜드 정합 색상: indigo-500 (#6366f1) — 대시보드 KPI 톤
 *   - 높이 4px (표준), showSpinner false (라우터 transition 만)
 *   - 모바일 RN 영향 0 — web layout.tsx 만
 *
 * canonical truth lock:
 *   - ThemeProvider / LocaleProvider / AuthSessionProvider / QueryProvider / QRScannerProviderWrapper
 *     stack 시그니처 변경 0
 *   - schema 0 / migration 0 / mutation 0
 *   - children 위치 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const NPROGRESS_COMPONENT_PATH = resolve(
  __dirname,
  "../../components/nprogress-bar.tsx",
);
const LAYOUT_PATH = resolve(__dirname, "../../app/layout.tsx");
const PACKAGE_JSON_PATH = resolve(__dirname, "../../../package.json");

const nprogressComponent = readFileSync(NPROGRESS_COMPONENT_PATH, "utf8");
const layout = readFileSync(LAYOUT_PATH, "utf8");
const packageJson = readFileSync(PACKAGE_JSON_PATH, "utf8");

describe("§11.246d-2 #1 — nprogress-bar.tsx 컴포넌트 (client component + AppProgressBar wrap)", () => {
  it("'use client' directive (next-nprogress-bar = client only)", () => {
    expect(nprogressComponent).toMatch(/^['"]use client['"]/m);
  });

  it("AppProgressBar import from next-nprogress-bar", () => {
    expect(nprogressComponent).toMatch(
      /import\s*\{[\s\S]{0,80}AppProgressBar[\s\S]{0,80}\}\s*from\s*["']next-nprogress-bar["']/,
    );
  });

  it("color = indigo-500 (#6366f1) — LabAxis 대시보드 KPI 정합", () => {
    expect(nprogressComponent).toMatch(/color=["']#6366f1["']/);
  });

  it("height = 4px (표준)", () => {
    expect(nprogressComponent).toMatch(/height=["']4px["']/);
  });

  it("options.showSpinner = false (라우터 transition 만)", () => {
    expect(nprogressComponent).toMatch(/showSpinner:\s*false/);
  });

  it("shallowRouting prop (App Router 정합)", () => {
    expect(nprogressComponent).toMatch(/shallowRouting/);
  });

  it("default export 또는 named export NProgressBar", () => {
    expect(nprogressComponent).toMatch(/export\s+(default\s+function|function)\s+NProgressBar/);
  });
});

describe("§11.246d-2 #2 — layout.tsx wiring (import + render)", () => {
  it("NProgressBar import from @/components/nprogress-bar", () => {
    expect(layout).toMatch(
      /import\s*\{[\s\S]{0,40}NProgressBar[\s\S]{0,40}\}\s*from\s*["']@\/components\/nprogress-bar["']/,
    );
  });

  it("<NProgressBar /> render — body 안 어디든", () => {
    expect(layout).toMatch(/<NProgressBar\s*\/?>/);
  });
});

describe("§11.246d-2 #3 — package.json dependency", () => {
  it("next-nprogress-bar in dependencies", () => {
    expect(packageJson).toMatch(/"next-nprogress-bar"\s*:\s*"[\^~]?\d+\.\d+\.\d+/);
  });
});

describe("§11.246d-2 #4 — invariant 보존", () => {
  it("ThemeProvider / LocaleProvider / AuthSessionProvider / QueryProvider stack 보존", () => {
    expect(layout).toMatch(/<ThemeProvider>[\s\S]{0,500}<LocaleProvider>[\s\S]{0,500}<AuthSessionProvider>[\s\S]{0,500}<QueryProvider>/);
  });

  it("QRScannerProviderWrapper {children} 보존", () => {
    expect(layout).toMatch(/<QRScannerProviderWrapper>\s*\{children\}/);
  });

  it("Toaster + SonnerToaster + CompareFlowGuard + Analytics 보존", () => {
    expect(layout).toMatch(/<Toaster\s*\/>/);
    expect(layout).toMatch(/SonnerToaster/);
    expect(layout).toMatch(/<CompareFlowGuard\s*\/>/);
    expect(layout).toMatch(/<Analytics\s*\/>/);
  });

  it("§11.246d-2 trace marker comment", () => {
    expect(nprogressComponent).toMatch(/§11\.246d-2[\s\S]{0,300}(nprogress|NProgress|페이지 전환|progress bar)/i);
  });
});
