/**
 * §safety-modal-upgrade P3 (호영님 2026-07-04) — MSDS 등록 모달 고도화.
 * 드래그&드롭 업로드 + 프리뷰(파일명·용량·삭제) · 맥락 배너 · 라벨 · 파일없으면 제출 비활성.
 * 공단 Open API 교차확인은 키 확보 후(정직 defer note). 공식 PDF=공급사 문서 필수 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§safety-modal-upgrade P3 — MSDS 모달", () => {
  it("드래그&드롭 존 + 하이라이트 상태", () => {
    expect(PAGE).toMatch(/msdsDragging/);
    expect(PAGE).toMatch(/onDrop=/);
    expect(PAGE).toMatch(/끌어다 놓거나 클릭해 선택/);
  });
  it("파일 프리뷰(용량·업로드 준비됨·삭제)", () => {
    expect(PAGE).toMatch(/업로드 준비됨/);
    expect(PAGE).toMatch(/msdsFile\.size/);
    expect(PAGE).toMatch(/setMsdsFile\(null\)/);
  });
  it("라벨 + 맥락 배너", () => {
    expect(PAGE).toMatch(/공급사 MSDS 선택/);
    expect(PAGE).toMatch(/공급사가 제공한 공식 안전보건자료/);
    expect(PAGE).toMatch(/규정 준수 불가 상태입니다/);
  });
  it("파일 없으면 제출 비활성(no-op 방지) 보존", () => {
    expect(PAGE).toMatch(/disabled=\{msdsSaving \|\| !msdsFile\}/);
  });
  it("공단 자동대조 defer 정직 표기(가짜 교차확인 UI 금지)", () => {
    expect(PAGE).toMatch(/Open API 연동 후 제공/);
    expect(PAGE).not.toMatch(/공단 물질명이 재고 물질명과 다릅니다/); // 미구현 교차확인 UI 하드코딩 금지
  });
});
