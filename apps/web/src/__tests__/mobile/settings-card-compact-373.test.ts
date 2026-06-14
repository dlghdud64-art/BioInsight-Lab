/**
 * §11.373 #settings-card-compact — 설정 카드 compact 토큰 sweep sentinel.
 *
 * §11.311 모바일 공통 원칙 강제:
 *  - SectionCard: 모바일 패딩 compact(p-3), md+ 밀도 유지(md:p-5)
 *  - workspace 식별(명칭/코드/통화): 모바일 compact row, full-box 적층 제거 / md+ 카드 grid
 *  - 빈 워크스페이스 fallback 카피 개선
 *
 * readFileSync + regex (CLAUDE.md sentinel 패턴).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const settings = readFileSync(
  resolve(__dirname, "../../app/dashboard/settings/page.tsx"),
  "utf8",
);

describe("§11.373 SectionCard primitive compact", () => {
  it("body 패딩: 모바일 p-3 + md:p-5 (이전 단일 p-5 금지)", () => {
    expect(settings).toMatch(/<div className="p-3 md:p-5">\{children\}<\/div>/);
  });

  it("header 패딩: 모바일 px-4 py-3 + md 복원", () => {
    expect(settings).toMatch(/px-4 py-3 md:px-5 md:py-4/);
  });
});

describe("§11.373 workspace 식별 — 모바일 compact row / md+ 카드", () => {
  it("컨테이너: 모바일 divide row, md+ grid-cols-3 유지", () => {
    expect(settings).toMatch(/md:grid md:grid-cols-3/);
    expect(settings).toMatch(/divide-y divide-slate-100/);
  });

  it("필드: 모바일 inline row(flex justify-between) + md+ 카드 박스 복원", () => {
    expect(settings).toMatch(/flex items-center justify-between[\s\S]{0,80}md:block/);
  });

  it("meta sub-label(planSubLabel/AUTO-GENERATED 등)은 모바일 숨김(hidden md:block)", () => {
    expect(settings).toMatch(/hidden md:block[\s\S]{0,40}\{planSubLabel\}/);
  });

  it("회귀 0: canonical workspace 값(wsName/wsSlug) 표시 보존", () => {
    expect(settings).toMatch(/\{wsName\}/);
    expect(settings).toMatch(/\{wsSlug\}/);
    expect(settings).toMatch(/워크스페이스 명칭/);
    expect(settings).toMatch(/워크스페이스 코드/);
    expect(settings).toMatch(/기본 통화/);
  });
});

describe("§11.373 빈 워크스페이스 fallback 카피", () => {
  it("'데이터 미동기화' → '워크스페이스 미연결'", () => {
    expect(settings).toMatch(/"워크스페이스 미연결"/);
    expect(settings).not.toMatch(/"데이터 미동기화"/);
  });
});
