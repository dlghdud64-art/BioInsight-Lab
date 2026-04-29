/**
 * §11.142-impl #operational-brief-rail-purchase-conversion
 *
 * Source-level regression guard — purchases page rail 가 §11.142 spec 정합:
 * "운영 브리핑" title + 4 preset chips + 4-section structure + primary CTA.
 *
 * §11.142 direction lock 에서 정의된 운영 브리핑 패턴 land 검증.
 * α-A/α-B/α-C 의 데이터 의존 회귀 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/purchases/page.tsx",
);

describe("operational brief rail — §11.142-impl regression guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail title \"운영 브리핑\" 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("4 preset chips: 상태 요약 / 공급사 회신 / PO 전환 / 차단 사유", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/공급사 회신/);
    expect(source).toMatch(/PO 전환/);
    expect(source).toMatch(/차단 사유/);
  });

  it("4 section 헤딩: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상황 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("Primary CTA: 견적 관리에서 계속", () => {
    expect(source).toMatch(/견적 관리에서 계속/);
  });

  it("\"선택한 견적\" object label (internal raw label X)", () => {
    expect(source).toMatch(/선택한 견적/);
    // SELECTED OBJECT 같은 내부 라벨 부재
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    // textarea / placeholder "AI에게 물어보기" 등 chatbot 패턴 부재
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("α-A 회귀 0: PurchaseConversionItem fetch + selectedItem 유지", () => {
    expect(source).toMatch(/PurchaseConversionItem/);
    expect(source).toMatch(/selectedItem/);
  });

  it("α-D 회귀 0: selectReplyMutation 유지 (§11.21)", () => {
    expect(source).toMatch(/selectReplyMutation/);
  });

  it("α-F 회귀 0: AI rationale generator (§11.25) 유지", () => {
    expect(source).toMatch(/quote-rationale|aiRationale|AI 추천/);
  });

  it("rail desktop only (hidden md:flex) — same-canvas 보존", () => {
    expect(source).toMatch(/hidden md:flex/);
  });
});
