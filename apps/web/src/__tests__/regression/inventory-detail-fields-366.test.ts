import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §11.366 D-8 — 재고 상세 마스터 필드 보강 (Web) [라이브 재앵커]
 *
 * ⚠️ 재앵커 (2026-08-06, §inventory-detail-relive — 호영님 "이식" 확정):
 *   원 판본은 inventory-main.tsx(importer 0 dead file)를 잠갔고, D-8 수정
 *   자체가 dead file 에만 적용돼 라이브 상세 Sheet 는 보강 이전 상태였다
 *   (§11.361-2·1a 에 이은 미배송 사례 — 필드 4종·모바일 세로 스택 부재 실측).
 *   본 재앵커에서 계약을 라이브(inventory-content)로 이식하고 잠금을 교체했다.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const LIVE = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§11.366 D-8 Phase 1 — 재고 상세 마스터 필드 보강 (라이브 표면)", () => {
  it("행/카드 트리거 = 상세 Sheet 오픈 (no-op 0 회귀 가드)", () => {
    const src = read(LIVE);
    expect(src).toMatch(/setSelectedItem\(inv\)/);
    expect(src).toMatch(/setIsSheetOpen\(true\)/);
  });

  it("영문명(nameEn) 보강 — 값 있을 때만 표시 (가짜 금지)", () => {
    const src = read(LIVE);
    expect(src).toMatch(/selectedItem\.product\.nameEn &&/);
  });

  it("현재고 + 안전재고 표시 (조회 핵심)", () => {
    const src = read(LIVE);
    expect(src).toMatch(/>현재고</);
    expect(src).toMatch(/selectedItem\.currentQuantity\} \{selectedItem\.unit/);
    expect(src).toMatch(/>안전재고</);
    expect(src).toMatch(/selectedItem\.safetyStock != null/);
  });

  it("보관위치(location) 보강", () => {
    const src = read(LIVE);
    expect(src).toMatch(/>보관위치</);
    expect(src).toMatch(/selectedItem\.location \?\? "-"/);
  });

  it("고유 식별자 = inv.id (§11.355-B QR 정합)", () => {
    const src = read(LIVE);
    expect(src).toMatch(/>고유 식별자</);
    expect(src).toMatch(/\{selectedItem\.id\}/);
  });

  describe("§11.366 D-8 Phase 2 — 모바일 세로 스택 (가로 스크롤 0)", () => {
    it("기본/관리 정보 grid = 모바일 grid-cols-1, 데스크탑 sm:grid-cols-2", () => {
      const src = read(LIVE);
      const matches = src.match(/grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1\.5/g) ?? [];
      expect(matches.length).toBe(2);
    });

    it("상세 필드 grid 가로 욱여넣기(고정 grid-cols-2 gap-x-3) 제거", () => {
      const src = read(LIVE);
      expect(src).not.toMatch(/grid grid-cols-2 gap-x-3 gap-y-1\.5/);
    });
  });

  describe("회귀 0 — 기존 필드/구조 보존", () => {
    it("기존 필드(Lot번호·유효기한·Cat.No·보관조건·특이사항) 보존", () => {
      const src = read(LIVE);
      expect(src).toMatch(/Lot Number/);
      expect(src).toMatch(/유효 기한/);
      expect(src).toMatch(/Cat\.No\./);
      expect(src).toMatch(/보관조건/);
      expect(src).toMatch(/특이사항/);
    });

    it("Lot 목록 = 입고 이력 토글 활용 (restock history)", () => {
      const src = read(LIVE);
      expect(src).toMatch(/showRestockHistory/);
      expect(src).toMatch(/입고 이력/);
    });

    it("D-8 trace marker (라이브)", () => {
      const src = read(LIVE);
      expect(src).toMatch(/§11\.366 D-8/);
    });
  });
});
