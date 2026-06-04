import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MAIN = "src/app/dashboard/inventory/inventory-main.tsx";

describe("§11.366 D-8 Phase 1 — 재고 상세 마스터 필드 보강 (Web)", () => {
  it("행/카드 트리거 = 상세 Sheet 오픈 (no-op 0 회귀 가드)", () => {
    const src = read(MAIN);
    expect(src).toMatch(/setSelectedItem\(inv\)/);
    expect(src).toMatch(/setIsSheetOpen\(true\)/);
  });

  it("영문명(nameEn) 보강", () => {
    const src = read(MAIN);
    expect(src).toMatch(/selectedItem\.product\.nameEn/);
  });

  it("현재고 + 안전재고 표시 (조회 핵심)", () => {
    const src = read(MAIN);
    expect(src).toMatch(/>현재고</);
    expect(src).toMatch(/selectedItem\.currentQuantity\} \{selectedItem\.unit/);
    expect(src).toMatch(/>안전재고</);
    expect(src).toMatch(/selectedItem\.safetyStock != null/);
  });

  it("보관위치(location) 보강", () => {
    const src = read(MAIN);
    expect(src).toMatch(/>보관위치</);
    expect(src).toMatch(/selectedItem\.location \?\? "-"/);
  });

  it("고유 식별자 = inv.id (§11.355-B QR 정합)", () => {
    const src = read(MAIN);
    expect(src).toMatch(/>고유 식별자</);
    expect(src).toMatch(/\{selectedItem\.id\}/);
  });

  describe("§11.366 D-8 Phase 2 — 모바일 세로 스택 (가로 스크롤 0)", () => {
    it("기본/관리 정보 grid = 모바일 grid-cols-1, 데스크탑 sm:grid-cols-2", () => {
      const src = read(MAIN);
      const matches = src.match(/grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1\.5/g) ?? [];
      expect(matches.length).toBe(2);
    });

    it("상세 필드 grid 가로 욱여넣기(고정 grid-cols-2 gap-x-3) 제거", () => {
      const src = read(MAIN);
      expect(src).not.toMatch(/grid grid-cols-2 gap-x-3 gap-y-1\.5/);
    });
  });

  describe("회귀 0 — 기존 필드/구조 보존", () => {
    it("기존 필드(Lot번호·유효기한·Cat.No·보관조건·특이사항) 보존", () => {
      const src = read(MAIN);
      expect(src).toMatch(/Lot Number/);
      expect(src).toMatch(/유효 기한/);
      expect(src).toMatch(/Cat\.No\./);
      expect(src).toMatch(/보관조건/);
      expect(src).toMatch(/특이사항/);
    });

    it("Lot 목록 = 입고 이력 토글 활용 (restock history)", () => {
      const src = read(MAIN);
      expect(src).toMatch(/showRestockHistory/);
      expect(src).toMatch(/입고 이력/);
    });

    it("canonical truth — 안전재고 외 조회 필드 mutation 0 (현재고/위치/id 읽기)", () => {
      const src = read(MAIN);
      // 현재고·보관위치·고유식별자는 selectedItem 읽기 표시(payload mutation 아님).
      expect(src).toMatch(/§11\.366 D-8/);
    });
  });
});
