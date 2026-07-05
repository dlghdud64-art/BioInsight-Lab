/**
 * §support-center P2 (호영님 2026-07-05) — 안전·규제 카테고리 + 가이드 리더 패널 + AI 근거검색.
 * §2 안전 카테고리(MSDS·GHS·LOT·유효기간·GMP, 제품 실기능 링크) + 인기 3카드 + same-canvas 슬라이드 리더.
 * §5 AI 도우미 = 매뉴얼/시나리오 인덱스 실매칭(출처 칩·리더 딥링크). LLM 생성·할루시네이션·fake 답변 0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P2 — 안전 카테고리 + 리더 + AI 근거검색", () => {
  it("§2 안전·규제 카테고리 + 실기능 가이드(sf-1..sf-5, 실 링크)", () => {
    expect(PAGE).toMatch(/id: "safety", label: "안전·규제/);
    expect(PAGE).toMatch(/id: "sf-1"/);
    expect(PAGE).toMatch(/href: "\/dashboard\/safety"/);
    expect(PAGE).toMatch(/href: "\/dashboard\/audit"/);
  });
  it("§2 same-canvas 슬라이드 리더 패널 + 인기 가이드 3카드", () => {
    expect(PAGE).toMatch(/readerGuide/);
    expect(PAGE).toMatch(/인기 가이드/);
  });
  it("§5 AI 도우미 = 근거 기반 인덱스 매칭(생성/할루시네이션 0)", () => {
    expect(PAGE).toMatch(/출처: 운영 매뉴얼/);
    expect(PAGE).toMatch(/매뉴얼에서 근거를 찾지 못했습니다/);
    // AI 응답용 LLM 생성 API 호출 부재(인덱스 매칭만). /api/support/inquiry(문의 제출)는 별개.
    expect(PAGE).not.toMatch(/\/api\/ai\b|generateText|completion|openai|anthropic/);
  });
  it("회귀 0 — ⌘K·handleTabChange 보존", () => {
    expect(PAGE).toMatch(/const handleTabChange/);
    expect(PAGE).toMatch(/e\.metaKey \|\| e\.ctrlKey/);
  });
});
