/**
 * §11.144 #operational-brief-rail-rfq-detail
 *
 * Source-level regression guard — /dashboard/quotes 의 right rail (lines ~920-1124)
 * 가 §11.142 운영 브리핑 패턴 정합:
 * "운영 브리핑" title + 4 preset chips + 4-section structure + primary CTA.
 *
 * 기존 6-section (운영 요약 / 회신·비교 / 최근 활동 / 판단 요약 / 연결 작업 / 3 CTA) 의
 * canonical content 는 모두 보존하면서 §11.142 spec 의 4 canonical section header 로
 * label 정형화 + 4 chips + 운영 브리핑 헤더 land.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/quotes/page.tsx",
);

describe("operational brief rail (RFQ-Quote detail) — §11.144 regression guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail title \"운영 브리핑\" 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("Object label \"선택한 견적\" 존재", () => {
    expect(source).toMatch(/선택한 견적/);
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("4 preset chips: 상태 요약 / 회신 현황 / 비교 진행 / 발주 전환", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/회신 현황/);
    expect(source).toMatch(/비교 진행/);
    expect(source).toMatch(/발주 전환/);
  });

  it("4 canonical section 라벨: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상황 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("회귀 0: 기존 5 canonical operating field 유지 (현재 상태/차단/다음 액션/비교/발주)", () => {
    expect(source).toMatch(/현재 상태/);
    expect(source).toMatch(/차단\/위험|차단/);
    expect(source).toMatch(/다음 액션/);
    expect(source).toMatch(/비교 가능/);
    expect(source).toMatch(/발주 전환 가능/);
  });

  it("회귀 0: 회신 정보 + AI recommendation 보존", () => {
    expect(source).toMatch(/수신 견적/);
    expect(source).toMatch(/aiRecommendation/);
  });

  it("회귀 0: bottom sticky CTA + railCtaLabel 보존", () => {
    expect(source).toMatch(/railCtaLabel/);
    expect(source).toMatch(/setActiveWorkWindow/);
  });

  it("rail desktop only (hidden lg:flex) — same-canvas 보존", () => {
    expect(source).toMatch(/hidden lg:flex/);
  });
});
