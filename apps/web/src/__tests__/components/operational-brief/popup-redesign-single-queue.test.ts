/**
 * §brief-redesign #single-queue-inline-ai — 호영님 P1 (운영 브리핑 핸드오프 2026-06-28).
 *
 * 계약(TDD RED): 운영 브리핑 popup 을 "카테고리 탭 게이트"에서
 *   "모듈 무관 단일 오늘 할 일 큐 + 인라인 1줄 AI 근거 + 조치"로 리디자인.
 *   본 파일은 **목표 구조**를 고정한다 — P3(UI 리팩토링) 전까지 RED.
 *
 * 정본 spec: uploads/운영 브리핑 핸드오프.md
 * 승인(호영님 2026-06-28): 공유 popup(8 surface) / LIVE 제거 /
 *   act-primary 실액션 가드 / data-days 숫자 파생.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 * ⚠️ P3 구현 전에는 GREEN 섹션이 실패하는 것이 정상(RED 계약).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP = readFileSync(
  resolve(__dirname, "../../../components/operational-brief/popup.tsx"),
  "utf8",
);

describe("§brief-redesign — 단일 큐 + 2섹션 (TARGET, P3 후 GREEN)", () => {
  it("카테고리 게이트 제거 — '카테고리 선택' 그리드 부재", () => {
    expect(POPUP).not.toContain("카테고리 선택");
    expect(POPUP).not.toContain("먼저 처리할 영역");
  });
  it("기본 viewMode 가 category-grid 가 아님 (단일 큐 우선)", () => {
    expect(POPUP).not.toContain('useState<"category" | "list">("category")');
  });
  it("2섹션 라벨 — '지금 처리' / '검토 대기'", () => {
    expect(POPUP).toContain("지금 처리");
    expect(POPUP).toContain("검토 대기");
  });
});

describe("§brief-redesign — 필터 칩 + 요약 스트립 (TARGET)", () => {
  it("필터 칩 마커 data-brief-chip 노출 (게이트 아닌 필터)", () => {
    expect(POPUP).toContain("data-brief-chip");
  });
  it("요약 스트립 '임박 마감' KPI", () => {
    expect(POPUP).toContain("임박 마감");
  });
});

describe("§brief-redesign — 인라인 1줄 AI 근거 (TARGET)", () => {
  it("'AI 판단' 1줄 근거 태그 노출", () => {
    expect(POPUP).toContain("AI 판단");
  });
  it("구 6-section dossier 제거 — 'LABAXIS AI INSIGHT' / 'Critical Evidence' 부재", () => {
    expect(POPUP).not.toContain("LABAXIS AI INSIGHT");
    expect(POPUP).not.toContain("Critical Evidence");
  });
});

describe("§brief-redesign — LIVE 인디케이터 제거 (승인된 결정)", () => {
  it("'Real-time Operations' / LIVE 펄스 도트 부재", () => {
    expect(POPUP).not.toContain("Real-time Operations");
    expect(POPUP).not.toContain("bg-emerald-400");
  });
});

describe("§brief-redesign — 보존(회귀 0): 아코디언 단일오픈 + a11y", () => {
  it("aria-expanded 키보드 접근 유지", () => {
    expect(POPUP).toContain("aria-expanded");
  });
  it("단일 오픈 selection state 유지(selectedItemId)", () => {
    expect(POPUP).toContain("selectedItemId");
  });
});
