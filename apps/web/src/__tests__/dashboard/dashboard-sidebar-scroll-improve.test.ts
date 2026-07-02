/**
 * §사이드바 스크롤 개선 (호영님) — 헤더/푸터 고정 + 가운데 메뉴만 스크롤
 *   페이드 마스크 + 얇은 오버레이 스크롤바 + overscroll-contain.
 *
 * 목적: 창 높이가 줄어 메뉴가 잘릴 때, 브랜드(상단)·서비스 홈으로(하단) 앵커는
 *       항상 보이고 가운데 메뉴만 스크롤. 두꺼운 기본 스크롤바 → 얇은 오버레이 바로 대체.
 * 회귀 0: 헤더 flex-shrink-0 / 푸터 mt-auto flex-shrink-0 / 스크롤 flex-1 overflow-y-auto 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/app/_components/dashboard-sidebar.tsx"),
  "utf8",
);
const CSS = readFileSync(join(REPO_ROOT, "src/app/globals.css"), "utf8");

describe("§사이드바 스크롤 개선 — 개선 wiring", () => {
  it("스크롤 컨테이너에 sidebar-scroll + overscroll-contain 적용", () => {
    expect(SRC).toMatch(
      /flex-1 overflow-y-auto overscroll-contain sidebar-scroll/,
    );
  });
  it("globals.css .sidebar-scroll 페이드 마스크 정의", () => {
    expect(CSS).toMatch(/\.sidebar-scroll\s*\{[^}]*mask:\s*linear-gradient/);
  });
  it("얇은 오버레이 바 — 6px + hover 시에만 thumb 노출", () => {
    expect(CSS).toMatch(/\.sidebar-scroll::-webkit-scrollbar\s*\{\s*width:\s*6px/);
    expect(CSS).toMatch(
      /\.sidebar-scroll:hover::-webkit-scrollbar-thumb\s*\{\s*background:\s*rgba\(255,\s*255,\s*255,\s*0\.22\)/,
    );
    // 평소 thumb 은 transparent (기본 두꺼운 바 노출 금지)
    expect(CSS).toMatch(
      /\.sidebar-scroll::-webkit-scrollbar-thumb\s*\{\s*background:\s*transparent/,
    );
  });
});

describe("§사이드바 스크롤 개선 — 회귀 0 (헤더/푸터 고정 보존)", () => {
  it("데스크탑 브랜드 헤더 flex-shrink-0 고정", () => {
    expect(SRC).toMatch(/h-16 hidden lg:flex[^"]*flex-shrink-0/);
  });
  it("하단 서비스 홈으로 mt-auto flex-shrink-0 고정", () => {
    expect(SRC).toMatch(/mt-auto p-4 border-t border-slate-800 flex-shrink-0/);
    expect(SRC).toMatch(/서비스 홈으로/);
  });
  it("스크롤 영역 flex-1 overflow-y-auto 보존", () => {
    expect(SRC).toMatch(/flex-1 overflow-y-auto/);
  });
});
