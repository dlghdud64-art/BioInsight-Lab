import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §receiving-quickview-compact (호영님 2026-07-08) — 퀵뷰 드로어 액션 footer 위치 시안 정합.
 *
 * 이전: body 가 flex-1 이라 짧은 콘텐츠에도 늘어나 footer(액션 버튼)를 드로어 맨 아래로 밀어
 *   중간에 빈 공간이 크게 남음. 시안(입고 목록 웹 리디자인 v2.html §quickview)은 footer 가
 *   콘텐츠 바로 밑에 붙음 → body flex-1 제거로 정합. 액션/핸들러 회귀 0.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const DRAWER = "src/components/receiving/receiving-quickview-drawer.tsx";

describe("§receiving-quickview-compact — 액션 footer 콘텐츠 바로 밑(시안 정합)", () => {
  it("body flex-1 제거 — footer 하단 고정(빈 공간) 회귀 차단", () => {
    const src = read(DRAWER);
    expect(src).not.toMatch(/flex-1 overflow-y-auto px-5 py-5/);
    expect(src).toMatch(/overflow-y-auto px-5 py-5/);
  });
});

describe("§receiving-quickview-compact — 회귀 0(액션·상세·Esc 보존)", () => {
  it("footer 액션·상세 열기·Esc 닫기 wiring 보존(no-op 0)", () => {
    const src = read(DRAWER);
    expect(src).toMatch(/onAction\(visual\.action/);
    expect(src).toMatch(/onClick=\{\(\) => onDetail\(item\)\}/);
    expect(src).toMatch(/e\.key === "Escape"/);
  });
});
