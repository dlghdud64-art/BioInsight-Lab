import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const DRAWER = "src/components/receiving/receiving-quickview-drawer.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";

describe("§11.334 P3 — 퀵뷰 드로어(same-canvas)", () => {
  it("파생 함수 소비 (step/doc/visual)", () => {
    const src = read(DRAWER);
    expect(src).toMatch(/resolveReceivingStepStates/);
    expect(src).toMatch(/resolveReceivingStepCode/);
    expect(src).toMatch(/resolveReceivingDocState/);
    expect(src).toMatch(/resolveReceivingRowVisual/);
  });

  it("진행 스텝 4단계 라벨 + Esc 닫기", () => {
    const src = read(DRAWER);
    expect(src).toMatch(/입고", "검수", "문서", "반영"/);
    expect(src).toMatch(/e\.key === "Escape"/);
  });

  it("상태별 액션 라벨(문서 확보/재고 반영/검수 시작)", () => {
    const src = read(DRAWER);
    expect(src).toMatch(/coa: "문서 확보"/);
    expect(src).toMatch(/post: "재고 반영"/);
    expect(src).toMatch(/inspect: "검수 시작"/);
  });

  it("액션·상세·닫기 실 핸들러 연결(no-op 0)", () => {
    const src = read(DRAWER);
    expect(src).toMatch(/onClick=\{onClose\}/);
    expect(src).toMatch(/onClick=\{\(\) => onDetail\(item\)\}/);
    expect(src).toMatch(/onAction\(visual\.action/);
  });

  it("무효 Tailwind 스케일 없음", () => {
    const src = read(DRAWER);
    expect(src).not.toMatch(/h-4\.5|w-4\.5/);
  });
});

describe("§11.334 P3 — page 드로어 배선", () => {
  it("행클릭 → 드로어 오픈(라우트 이동 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/onRowClick=\{\(item\) => setQuickviewItem\(item\)\}/);
    expect(src).toMatch(/<ReceivingQuickviewDrawer/);
  });
  it("드로어 액션은 실 라우팅(no-op 0)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/onDetail=\{\(item\) => goDetail\(item\)\}/);
    expect(src).toMatch(/goDetail\(item\);/);
  });
});
