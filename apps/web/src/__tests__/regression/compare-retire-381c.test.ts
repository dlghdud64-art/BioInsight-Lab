/**
 * §11.381 Phase B — compare 라우트 retire + 내부 재배선 sentinel
 *
 * 호영님 결정 (2026-06-10):
 *   - b2: AI 비교 분석 = 소싱 비교 검토 단계가 canonical, compare 라우트는 stale 잔재
 *   - (가): 파일럿 단계·외부 노출 0 → redirect 없음, 내부 링크 전수 재배선 + 라우트 삭제
 *
 * 제거 4라우트 (실파일 7개):
 *   /compare(+quote) · /app/compare(re-export) · _workbench/compare(+_components)
 *
 * 재배선 매핑:
 *   /app/compare → /app/search (소싱 워크벤치 — 비교 검토 same-canvas 흡수 §11.381a/b)
 *   /compare?search=X → /app/search?q=X (inventory 2곳)
 *   /compare/quote/${id} → /quotes/${id} (vendor/quotes·protocol-upload — 기존 dead link 교정)
 *
 * 스코프 밖 (latent-dead 기존 잔재 — 별도 cleanup batch):
 *   /test/* 링크 · _workbench/_components/step-nav.tsx · isFlowPath /test 정규식
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

function gone(rel: string): boolean {
  return !existsSync(join(REPO_ROOT, rel));
}

describe("§11.381c — compare 라우트 부재 (4라우트 · 실파일 7개)", () => {
  it("/compare 구형 페이지 + _components 제거", () => {
    expect(gone("src/app/compare/page.tsx")).toBe(true);
    expect(gone("src/app/compare/_components/compare-analysis-drawer.tsx")).toBe(true);
    expect(gone("src/app/compare/_components/compare-history-section.tsx")).toBe(true);
  });

  it("/compare/quote 구형 견적 페이지 제거", () => {
    expect(gone("src/app/compare/quote/page.tsx")).toBe(true);
  });

  it("/app/compare re-export 제거", () => {
    expect(gone("src/app/app/compare/page.tsx")).toBe(true);
  });

  it("_workbench/compare 본체 + virtualized-table-body 제거", () => {
    expect(gone("src/app/_workbench/compare/page.tsx")).toBe(true);
    expect(gone("src/app/_workbench/compare/_components/virtualized-table-body.tsx")).toBe(true);
  });
});

describe("§11.381c — 내부 재배선: /app/compare → /app/search", () => {
  it("dashboard/page.tsx — compare 참조 0 + 소싱 진입점 존재", () => {
    const src = read("src/app/dashboard/page.tsx");
    expect(src).not.toMatch(/\/app\/compare/);
    expect(src).not.toMatch(/href=["'`]\/compare/);
    expect(src).toMatch(/\/app\/search/);
  });

  it("dashboard/reports/page.tsx — compare 참조 0", () => {
    const src = read("src/app/dashboard/reports/page.tsx");
    expect(src).not.toMatch(/\/app\/compare/);
    expect(src).toMatch(/\/app\/search/);
  });

  it("_workbench/quote/page.tsx — push 3곳 /app/search 재배선", () => {
    const src = read("src/app/_workbench/quote/page.tsx");
    expect(src).not.toMatch(/router\.push\(["'`]\/app\/compare["'`]\)/);
    expect(src).toMatch(/router\.push\(["'`]\/app\/search["'`]\)/);
  });

  it("compare-flow-guard — push 목적지 /app/search", () => {
    const src = read("src/components/layout/compare-flow-guard.tsx");
    expect(src).not.toMatch(/router\.push\(["'`]\/app\/compare["'`]\)/);
    expect(src).toMatch(/router\.push\(["'`]\/app\/search["'`]\)/);
  });

  it("app/step-nav.tsx — compare step 제거 (search→quote 2단계)", () => {
    const src = read("src/app/app/step-nav.tsx");
    expect(src).not.toMatch(/\/app\/compare/);
    expect(src).not.toMatch(/id:\s*["']compare["']/);
    expect(src).toMatch(/id:\s*["']search["']/);
    expect(src).toMatch(/id:\s*["']quote["']/);
  });

  it("org-overview-hub — Step 비교 큐 href /app/search 재배선", () => {
    const src = read("src/components/ops-hub/org-overview-hub.tsx");
    expect(src).not.toMatch(/\/app\/compare/);
    expect(src).toMatch(/\/app\/search/);
  });
});

describe("§11.381c — 내부 재배선: 쿼리·견적 경로", () => {
  it("inventory 2곳 — /compare?search= → /app/search?q=", () => {
    for (const rel of [
      "src/app/dashboard/inventory/inventory-content.tsx",
      "src/app/dashboard/inventory/inventory-main.tsx",
    ]) {
      const src = read(rel);
      expect(src).not.toMatch(/\/compare\?search=/);
      expect(src).toMatch(/\/app\/search\?q=/);
    }
  });

  it("vendor/quotes — /compare/quote/${id} → /quotes/${id} (기존 dead link 교정)", () => {
    const src = read("src/app/dashboard/vendor/quotes/page.tsx");
    expect(src).not.toMatch(/\/compare\/quote\//);
    expect(src).toMatch(/\/quotes\/\$\{quote\.id\}/);
  });

  it("protocol-upload — /compare/quote/${id} → /quotes/${id} (기존 dead link 교정)", () => {
    const src = read("src/components/protocol/protocol-upload.tsx");
    expect(src).not.toMatch(/\/compare\/quote\//);
    expect(src).toMatch(/\/quotes\/\$\{data\.quote\.id\}/);
  });

  it("quotes/[id] — /compare?sessionId= 참조 0", () => {
    const src = read("src/app/quotes/[id]/page.tsx");
    expect(src).not.toMatch(/\/compare\?sessionId/);
  });
});

describe("§11.381c — 회귀 0: 흡수 surface·API 생존", () => {
  it("소싱 흡수 surface 생존 (381a/b 산출물)", () => {
    expect(gone("src/app/_workbench/_components/sourcing-spec-compare-section.tsx")).toBe(false);
    expect(gone("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx")).toBe(false);
    expect(gone("src/app/_workbench/_components/sourcing-result-review-workbench.tsx")).toBe(false);
  });

  it("데이터 경로 API 생존 (라우트만 제거, API 스코프 밖)", () => {
    expect(gone("src/app/api/products/compare/route.ts")).toBe(false);
    expect(gone("src/app/api/sourcing/recommend/route.ts")).toBe(false);
  });

  it("소싱 워크벤치 진입점 생존: /app/search", () => {
    expect(gone("src/app/app/search/page.tsx")).toBe(false);
    const src = read("src/app/app/search/page.tsx");
    expect(src).toMatch(/SearchPage/);
  });
});
