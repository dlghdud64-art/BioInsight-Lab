/**
 * §safety-modal-upgrade P4a (호영님 2026-07-04) — 점검 기록 모달 UI(물질 대표 점검).
 * lot 안내 삭제 → 물질 대표 배지 · 이상 발견 ON→내용·심각도3단·사진 펼침(빨강).
 * 저장 엔드포인트(물질 대표)는 P4b(operator). 그 전까지 제출은 정직-disabled(가짜성공 금지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§safety-modal-upgrade P4a — 점검 모달 UI", () => {
  it("물질 대표 점검 배지 + lot 단위 안내 삭제", () => {
    expect(PAGE).toMatch(/물질 대표 점검/);
    expect(PAGE).not.toMatch(/재고\(lot\) 단위로 관리됩니다/);
    expect(PAGE).not.toMatch(/점검 연계 준비 중/);
  });
  it("이상 발견 → 심각도 3단 + 사진 + 조치 확장", () => {
    expect(PAGE).toMatch(/경미·관찰/);
    expect(PAGE).toMatch(/주의·조치 필요/);
    expect(PAGE).toMatch(/긴급·즉시 격리/);
    expect(PAGE).toMatch(/inspPhoto/);
    expect(PAGE).toMatch(/severity/);
  });
  it("이상 발견 라벨 = 빨강(핸드오프 색 규칙)", () => {
    expect(PAGE).toMatch(/text-red-600">이상 발견/);
  });
  it("저장 정직-disabled(가짜성공 금지) — setTimeout 로컬 flip 없음", () => {
    // 점검 저장 버튼은 엔드포인트 배선(P4b) 전까지 disabled. 가짜 성공 패턴 부재.
    expect(PAGE).toMatch(/점검 기록 저장/);
    expect(PAGE).not.toMatch(/setTimeout\([^)]*setInspDialogOpen/);
  });
});
