import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";
const VIEW = "src/components/inventory/mobile-inventory-view.tsx";

describe("§11.328 — 재고 관리 모바일 시안(§03) 정합", () => {
  it("재발주 배너가 accent(blue) 톤이다 (rose 홍수 제거)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/bg-blue-50 border border-blue-200 rounded-xl[^"]*flex items-center gap-3 active:bg-blue-100/);
    expect(src).toMatch(/bg-blue-600 text-white text-\[12px\] font-extrabold[^"]*rounded-full/);
  });

  it("재발주 배너 아이콘 칩이 흰 배경 + blue-200 + blue-700 이다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/bg-white border border-blue-200 grid place-items-center text-blue-700/);
  });

  it("재발주 배너 위험 신호는 수치만 rose 강조 (제목·본문 위험색 아님)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/text-\[13\.5px\] font-extrabold text-slate-900 truncate/); // 제목 검정
    expect(src).toMatch(/현재 <b className="font-extrabold text-rose-700">/); // 수치만 rose
    expect(src).not.toMatch(/bg-rose-50 border border-rose-200 rounded-xl[^"]*active:bg-rose-100/); // 구 rose 배너 잔재 0
  });

  it("모바일 KPI 카드가 흰 배경 + 상태 도트다 (rose 채운 카드 제거)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/flex-1 rounded-\[13px\][^`]*bg-white shadow-sm/);
    expect(src).toMatch(/h-\[7px\] w-\[7px\] rounded-full \$\{k\.alert && k\.value > 0 \? "bg-rose-500" : "bg-slate-300"\}/);
    expect(src).not.toMatch(/bg-rose-50 border-rose-200" : "bg-white border-slate-200 shadow-sm/); // 구 채운 카드 잔재 0
  });

  it("재고 등록 + ⋮ 가 헤더 제목 우측 클러스터에 있다 (본문 부유 제거)", () => {
    const src = read(CONTENT);
    // 제목 flex 행 안에 hact 클러스터
    expect(src).toMatch(/flex items-start gap-2\.5 mb-3\.5/);
    expect(src).toMatch(/flex items-center gap-2 flex-none/);
    // 구 본문 부유 액션 행 제거
    expect(src).not.toMatch(/flex flex-wrap items-start gap-2 mb-5/);
  });
});

describe("§11.328 — 회귀 보호 (액션 wiring 보존)", () => {
  it("재고 등록·오버플로 핸들러가 유지된다", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/onClick=\{\(\) => setIsDialogOpen\(true\)\}/);
    expect(src).toMatch(/menuId="inv-content-utility-mobile"/);
    expect(src).toMatch(/router\.push\("\/dashboard\/purchases"\)/);
    expect(src).toMatch(/setIsImportStagingOpen\(true\)/);
    expect(src).toMatch(/router\.push\("\/dashboard\/inventory\/scan"\)/);
    expect(src).toMatch(/handleBulkLabelPrint\(\)/);
  });

  it("재발주 배너 onReorder 실 핸들러가 유지된다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/onClick=\{\(\) => onReorder\(topReorder\)\}/);
  });
});
