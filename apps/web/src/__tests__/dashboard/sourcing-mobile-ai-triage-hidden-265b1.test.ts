/**
 * §11.265b-1 — 【SUPERSEDED by §1-3】 AI 제안 fallback inline
 *
 * 원래 §11.265b-1: AI 제안 fallback + TRIAGE 블록을 모바일 hidden(md:block), 데스크탑만 노출.
 *   - TRIAGE 콘텐츠(sourcing-result-triage / sourcingTriage.sections.map)는 §11.292에서 제거됨 → 일부 stale.
 *   - §1-3/§4: AI 제안 fallback 을 모든 뷰포트 노출하는 상단 우선 배너 1개(pickTopBanner)로 전환,
 *     "AI 제안" 라벨 폐기. 따라서 hidden md:block + "AI 제안" 라벨 assertion 은 SUPERSEDE.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265b-1 → §1-3 supersede — inline AI 제안 → 상단 우선 배너", () => {
  it("상단 우선 배너 1개(sourcing-top-banner) 전뷰포트 노출(block)", () => {
    expect(page).toMatch(/data-testid="sourcing-top-banner"/);
    expect(page).toMatch(/className="block px-4 pt-1\.5"/);
  });

  it("pickTopBanner(우선순위 최고 1건) 배선", () => {
    expect(page).toMatch(/pickTopBanner\(aiSearchSummary\)/);
  });

  it("'AI 제안' 라벨 폐기(§1-3)", () => {
    expect(page).not.toMatch(/font-semibold text-blue-600 shrink-0">AI 제안</);
  });

  it("hidden md:block AI 제안 wrapper 제거", () => {
    expect(page).not.toMatch(/aiShouldShow[\s\S]{0,120}className="hidden md:block px-4 pt-1\.5"/);
  });
});

describe("§11.265b-1 — 회귀 0(보존 invariant)", () => {
  it("AI 제안 content 핵심 보존(비교 후보 담기 · dismiss)", () => {
    expect(page).toMatch(/비교 후보 담기/);
    expect(page).toMatch(/setAiDismissedHash\(aiContextHash\)/);
  });

  // §11.265a unified filter row 보존 assertion 제거 — 이전 배치에서 제거된 stale 가드.

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });
});
