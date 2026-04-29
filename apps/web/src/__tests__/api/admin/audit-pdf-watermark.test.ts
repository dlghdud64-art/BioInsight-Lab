/**
 * §11.130 #audit-pdf-watermark-image
 *
 * Source-level regression guard — /api/audit-logs/pdf-view 의 server-rendered
 * HTML 에 회사 로고 image embed + 디지털 서명 watermark.
 *
 * §11.109 follow-up — 컴플라이언스 audit 외부 보존 시 회사 식별성 향상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/api/audit-logs/pdf-view/route.ts",
);

describe("audit pdf-view watermark — regression guard (§11.130)", () => {
  const source = readFileSync(PATH, "utf8");

  it("brand logo image reference (Bio-Insight.png)", () => {
    expect(source).toMatch(/brand\/Bio-Insight\.png|Bio-Insight/);
  });

  it("img alt 속성 (스크린 리더 + 인쇄 시 fallback)", () => {
    expect(source).toMatch(/<img[^>]*alt=/);
  });

  it("digital watermark text (회사 정보 footer 보강)", () => {
    // bioinsightlab.com 또는 공식 도메인 / "LabAxis Audit System"
    expect(source).toMatch(/bioinsightlab|LabAxis Audit System|디지털 서명/);
  });

  it("logo CSS 스타일 (size 제한)", () => {
    expect(source).toMatch(/\.logo|max-width.*\d+px|height:\s*\d+px/);
  });

  it("기존 §11.109 정형 양식 회귀 0 — header / table / signature 보존", () => {
    expect(source).toMatch(/report-header/);
    expect(source).toMatch(/log-table/);
    expect(source).toMatch(/signature-row/);
  });
});
