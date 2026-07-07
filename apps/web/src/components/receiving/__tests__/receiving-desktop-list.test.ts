import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const CMP = "src/components/receiving/receiving-desktop-list.tsx";

describe("§11.334 P2 — 입고 목록 데스크탑 리스트(시안 퍼널·탭·카드)", () => {
  it("파생 순수함수를 소비한다 (canonical truth 대체 0)", () => {
    const src = read(CMP);
    expect(src).toMatch(/buildReceivingFunnel/);
    expect(src).toMatch(/buildReceivingTabCounts/);
    expect(src).toMatch(/resolveReceivingRowVisual/);
  });

  it("파이프라인 퍼널 4단계 라벨", () => {
    const src = read(CMP);
    expect(src).toMatch(/입고 대기/);
    expect(src).toMatch(/검수 대기/);
    expect(src).toMatch(/문서·판단/);
    expect(src).toMatch(/재고 반영/);
  });

  it("탭 3종(처리 필요/전체/완료)", () => {
    const src = read(CMP);
    expect(src).toMatch(/처리 필요/);
    expect(src).toMatch(/label: "전체"/);
    expect(src).toMatch(/label: "완료"/);
  });

  it("시안 색 토큰(rose/amber#b45821/blue/emerald)", () => {
    const src = read(CMP);
    expect(src).toMatch(/bg-rose-50 text-rose-700/);
    expect(src).toMatch(/text-\[#b45821\]/);
    expect(src).toMatch(/bg-blue-50 text-blue-700/);
    expect(src).toMatch(/bg-emerald-50 text-emerald-700/);
  });

  it("행 클릭이 실 핸들러에 연결(no-op 0)", () => {
    const src = read(CMP);
    expect(src).toMatch(/onClick=\{\(\) => onRowClick\(item\)\}/);
  });

  it("무효 Tailwind 스케일(h-4.5) 잔재 없음", () => {
    const src = read(CMP);
    expect(src).not.toMatch(/h-4\.5|w-4\.5/);
  });
});
