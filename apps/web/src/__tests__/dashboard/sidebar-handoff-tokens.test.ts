import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §sidebar-handoff (호영님 2026-07-08, sidebar-handoff.css) — 사이드바 색 토큰 리파인.
 *
 * 네이비를 #2c3c63 → #222d47 로 어둡게 + 비활성 아이콘을 400/70 흐린톤 → 400 솔리드로 밝게
 * (시인성 ↑). 본문 텍스트 #c7d0e4, active 텍스트 #222d47, footer "서비스 홈으로" blue-400 틴트.
 * ⚠ 활성 카테고리색(안전=sky 등 §11.302 결정)은 보존(호영님 2026-07-08 결정 2번).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SIDEBAR = read("src/app/_components/dashboard-sidebar.tsx");
const CSS = read("src/app/globals.css");

describe("§sidebar-handoff — 색 토큰 갱신", () => {
  it("globals 네이비 #222d47 / hover #2c3a5c", () => {
    expect(CSS).toMatch(/--sidebar-navy:\s*#222d47/);
    expect(CSS).toMatch(/--sidebar-navy-hover:\s*#2c3a5c/);
  });

  it("active 텍스트 #222d47 / 본문 텍스트 #c7d0e4", () => {
    expect(SIDEBAR).toMatch(/bg-white text-\[#222d47\] font-bold/);
    expect(SIDEBAR).toMatch(/text-\[#c7d0e4\] hover:text-white/);
  });

  it("비활성 아이콘 400 솔리드(흐린 -400/70 잔재 0)", () => {
    expect(SIDEBAR).not.toMatch(/text-(blue|indigo|emerald|teal|sky)-\d00\/70/);
    expect(SIDEBAR).toMatch(/inactive: "text-blue-400"/);
    expect(SIDEBAR).toMatch(/inactive: "text-sky-400"/);
  });

  it("footer 홈 버튼 blue-400 틴트(rgba 96,165,250 + #60a5fa)", () => {
    expect(SIDEBAR).toMatch(/rgba\(96,165,250,0\.08\)/);
    expect(SIDEBAR).toMatch(/text-\[#60a5fa\]/);
  });
});

describe("§sidebar-handoff — 회귀 0(활성 카테고리색 §11.302 보존)", () => {
  it("안전=sky-500 활성 유지(§11.302 정체성)", () => {
    expect(SIDEBAR).toMatch(/"\/dashboard\/safety":\s*\{\s*active:\s*"text-sky-500"/);
  });

  it("settings/audit active 흰 알약 가독 정정(slate-600, 구 slate-200 안 보임)", () => {
    expect(SIDEBAR).not.toMatch(/active:\s*"text-slate-200"/);
    expect(SIDEBAR).toMatch(/"\/dashboard\/settings":\s*\{\s*active:\s*"text-slate-600"/);
  });
});
