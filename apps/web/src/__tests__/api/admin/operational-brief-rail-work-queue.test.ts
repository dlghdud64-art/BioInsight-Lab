/**
 * §11.143 #operational-brief-rail-work-queue
 *
 * Source-level regression guard — Work Queue (운영 콘솔) detail panel 가
 * §11.142 direction lock 의 운영 브리핑 패턴 정합:
 * "운영 브리핑" title + 4 preset chips + 4-section structure + primary CTA.
 *
 * §11.142 의 패턴이 Purchase Conversion Queue 외 일반 surface (Work Queue)로
 * 확장되었음을 보장한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/dashboard/console/queue-detail-panel.tsx",
);

describe("operational brief rail (work queue) — §11.143 regression guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail title \"운영 브리핑\" 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("4 preset chips: 상태 요약 / 긴급 사유 / 인수인계 / 다음 단계", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/긴급 사유/);
    expect(source).toMatch(/인수인계/);
    expect(source).toMatch(/다음 단계/);
  });

  it("4 section 헤딩: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상황 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("Object label \"선택한 작업\" 존재 (selected work object label)", () => {
    expect(source).toMatch(/선택한 작업/);
    // SELECTED OBJECT 같은 내부 라벨 부재
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    // textarea / placeholder "AI에게 물어보기" 등 chatbot 패턴 부재
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("Primary CTA: item.primaryCtaLabel 사용 유지 (canonical truth)", () => {
    expect(source).toMatch(/primaryCtaLabel/);
    // onCtaClick 호출 wiring 유지
    expect(source).toMatch(/onCtaClick\(item\)/);
  });

  it("회귀 0: 기존 assignment action 유지 (claim / mark_in_progress)", () => {
    expect(source).toMatch(/onAssignmentAction/);
    expect(source).toMatch(/claim/);
  });

  it("회귀 0: handoffInfo 사용 유지 (§11.117 wiring 보존)", () => {
    expect(source).toMatch(/handoffInfo/);
  });

  it("회귀 0: navigateToEntity 보존 (관련 entity 이동 가능)", () => {
    expect(source).toMatch(/navigateToEntity|relatedEntityType/);
  });

  it("Sheet drawer 유지 (same-canvas, 별도 page-per-feature 금지)", () => {
    expect(source).toMatch(/Sheet/);
    expect(source).toMatch(/SheetContent/);
  });
});
