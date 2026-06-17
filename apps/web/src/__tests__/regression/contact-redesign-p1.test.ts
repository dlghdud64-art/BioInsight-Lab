/**
 * §contact-redesign P1 — 도입·문의 페이지(시안 A) 리디자인 sentinel
 *
 * 호영님 룰링 강제:
 *   ① ontology 무접촉 — 제품 DB/실데이터 API fetch 0, /api/support/inquiry(문의 인입)만.
 *   ② P1 룰베이스 분류기 + 큐레이션. "AI" 라벨 금지 → "문의 도우미/빠른 답변"(AI 즉답 배지 0).
 *   ③ 정직성 — 가격·SLA·고객사 단정 0, 1인 비동기 회신(전화·실시간 미운영), 사이드바 가짜 실적 0.
 *   - 기존 /api/support/inquiry 재사용(신규 API 0). classifyTopic → inquiryType 매핑.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "..", "app/support/page.tsx"), "utf8");

describe("§contact-redesign P1 (①) — ontology 무접촉 + inquiry 재사용", () => {
  it("룰베이스 분류기(classifyTopic + TOPICS)", () => {
    expect(SRC).toMatch(/function classifyTopic/);
    expect(SRC).toMatch(/const TOPICS/);
  });
  it("제품 DB/ontology API fetch 0 — 문의 인입만(§support-csrf-fix: csrfFetch)", () => {
    expect(SRC).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(SRC).not.toMatch(/\/api\/(inventory|quotes|dashboard|orders|stock|purchase)/);
  });
  it("inquiry API 재사용 + classifyTopic→inquiryType 매핑(신규 API 0)", () => {
    expect(SRC).toMatch(/inquiryType: category/);
    expect(SRC).toMatch(/setCategory\(answer\.topic\.inquiryType\)/);
  });
});

describe("§contact-redesign P1 (②) — 룰베이스, AI 라벨 금지", () => {
  it("'문의 도우미 / 빠른 답변' 라벨 + 'AI 즉답' 배지 미부여(P2 이관)", () => {
    expect(SRC).toMatch(/문의 도우미/);
    expect(SRC).toMatch(/빠른 답변/);
    expect(SRC).not.toMatch(/AI 즉답/);
  });
  it("도우미 → 폼 핸드오프(주제 분류 + prefill + 스크롤)", () => {
    expect(SRC).toMatch(/handoffToForm/);
    expect(SRC).toMatch(/이 내용으로 문의 남기기/);
  });
});

describe("§contact-redesign P1 (③) — 정직성", () => {
  it("1인 비동기 회신 — 전화·실시간 미운영 명시", () => {
    expect(SRC).toMatch(/전화·실시간 상담은 운영하지 않습니다/);
    expect(SRC).toMatch(/영업일 기준 1일 이내/);
  });
  it("신뢰 사이드바 가짜 실적/고객사 0(렌더 콘텐츠)", () => {
    // 가짜 도입 실적·고객사 보장 문구 금지(대시보드 가짜분포와 동일 위반).
    expect(SRC).not.toMatch(/\d+개\s*기관(이|을)?\s*도입|도입\s*기관\s*\d+\s*곳|\d+개사\s*고객/);
  });
  it("개인정보 수집 동의 + privacy 링크", () => {
    expect(SRC).toMatch(/개인정보처리방침/);
    expect(SRC).toMatch(/\/legal#privacy/);
  });
});

describe("§contact-redesign P1 — 폼 검증 + a11y + dead button 0", () => {
  it("검증(이메일 + 10자 + 동의 게이트)", () => {
    expect(SRC).toMatch(/emailValid/);
    expect(SRC).toMatch(/length >= 10/);
    expect(SRC).toMatch(/&& agree &&/);
  });
  it("a11y(role=status 토스트 + 입력 aria-label) + 인쇄 숨김", () => {
    expect(SRC).toMatch(/role="status"/);
    expect(SRC).toMatch(/aria-label="문의 도우미 질문 입력"/);
    expect(SRC).toMatch(/@media print \{ \.cp-assist/);
  });
  it("dead button 0 — 제출은 실제 fetch + 접수번호 노출", () => {
    expect(SRC).toMatch(/setResult\(\{ ok: true, refId: data\.referenceId \}\)/);
    expect(SRC).toMatch(/접수번호/);
  });
});
