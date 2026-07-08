import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §receiving-list-v2 P3 (호영님 2026-07-08) — 툴바 상태 실 필터
 *   (입고 목록 웹 리디자인 v2.html §toolbar "공급사·상태"). PLAN_receiving-list-v2 Phase 3.
 *
 * v2 mock 의 단일 "공급사·상태" 버튼을 dead button 대신 **실 클라이언트 필터**(가로 인라인
 * select)로 구현. 옵션은 items 파생(존재 값만). 0건 시 필터 초기화로 복구(strand 방지).
 *
 * ⚠ 공급사 필터 미구현 — receiving projection(ModuleLandingItem)에 공급사 필드 부재
 *   (title=입고건 제목, vendorName=PO 전용·receiving undefined). 오라벨 방지로 상태 필터만
 *   노출(호영님 2026-07-08 결정). 진짜 공급사는 inbox-adapter vendorName 스레딩 별건.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const CMP = "src/components/receiving/receiving-desktop-list.tsx";

describe("§receiving-list-v2 P3 — 상태 실 필터(no-op 아님)", () => {
  it("상태 필터 state + 파생 옵션(존재 값만)", () => {
    const src = read(CMP);
    expect(src).toMatch(/const \[statusFilter, setStatusFilter\]/);
    expect(src).toMatch(/statusOptions/);
  });

  it("visibleItems 에 실 필터 적용(dead button 아님)", () => {
    const src = read(CMP);
    expect(src).toMatch(/statusFilter !== "all"/);
    expect(src).toMatch(/list = list\.filter/);
  });

  it("툴바 상태 select 렌더 + a11y 라벨", () => {
    const src = read(CMP);
    expect(src).toMatch(/상태 전체/);
    expect(src).toMatch(/aria-label="상태 필터"/);
  });

  it("공급사 필터 미노출(오라벨 방지) — 공급사 select·state·title 필터 부재", () => {
    const src = read(CMP);
    expect(src).not.toMatch(/aria-label="공급사 필터"/);
    expect(src).not.toMatch(/supplierFilter/);
    expect(src).not.toMatch(/i\.title === supplierFilter/);
  });

  it("0건 시 필터 초기화(strand 방지)", () => {
    const src = read(CMP);
    expect(src).toMatch(/필터 초기화/);
  });
});

describe("§receiving-list-v2 P3 — 회귀 0(탭·행·focus 보존)", () => {
  it("탭·행 onRowClick·퍼널 focus 규칙 보존", () => {
    const src = read(CMP);
    expect(src).toMatch(/onClick=\{\(\) => onRowClick\(item\)\}/);
    expect(src).toMatch(/resolveReceivingFocusIndex\(funnel\)/);
    expect(src).toMatch(/처리 필요/);
  });
});
