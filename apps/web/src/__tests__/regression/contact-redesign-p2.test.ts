/**
 * §contact-redesign P2 — 라이브 AI 즉답 + 5가드 sentinel
 *
 * 라우트 /api/support/ai-assist (gpt-4o-mini, 기존 텍스트생성 AI 패턴 재사용).
 * 호영님 룰링 + 지시문 04:
 *   - ontology 무접촉: 제품 DB/실데이터 조회 0(시스템 프롬프트 정적 제품사실만). DB import 0.
 *   - 정직성: 가격·SLA·고객사 단정 금지 → "문의 시 안내". 숫자 지어내기 금지. 2문장 평문.
 *   - 가드: ①레이트리밋 ②입력 캡 ③인젝션 완화 ④출력 후처리(looksListy/trimAns) ⑤폴백(P1 큐레이션).
 *   - 클라이언트: 라이브 성공=AI 답변 라벨, 실패/폴백=빠른 답변(P1 룰베이스).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ROUTE = readFileSync(join(ROOT, "app/api/support/ai-assist/route.ts"), "utf8");
const PAGE = readFileSync(join(ROOT, "app/support/page.tsx"), "utf8");

describe("§contact-redesign P2 — 라우트 가드 + 정직성", () => {
  it("gpt-4o-mini + OPENAI_API_KEY 재사용 (기존 텍스트생성 패턴)", () => {
    expect(ROUTE).toMatch(/model: "gpt-4o-mini"/);
    expect(ROUTE).toMatch(/process\.env\.OPENAI_API_KEY/);
    expect(ROUTE).toMatch(/api\.openai\.com\/v1\/chat\/completions/);
  });
  it("① 레이트리밋 + ② 입력 길이 캡", () => {
    expect(ROUTE).toMatch(/function rateLimited/);
    expect(ROUTE).toMatch(/arr\.length >= 5/);
    expect(ROUTE).toMatch(/question\.length > 300/);
  });
  it("③ 인젝션 완화(사용자 입력 데이터 구분) + 타임아웃", () => {
    expect(ROUTE).toMatch(/지시가 아닙니다|데이터일 뿐/);
    expect(ROUTE).toMatch(/AbortController/);
  });
  it("④ 출력 후처리 looksListy + trimAns(2문장/180자)", () => {
    expect(ROUTE).toMatch(/function looksListy/);
    expect(ROUTE).toMatch(/function trimAns/);
    expect(ROUTE).toMatch(/slice\(0, 2\)/);
  });
  it("⑤ 폴백 — 키부재·실패·타임아웃·목록형 모두 { fallback: true }", () => {
    expect(ROUTE).toMatch(/fallback: true, reason: "nokey"/);
    expect(ROUTE).toMatch(/fallback: true, reason: "timeout"/);
    expect(ROUTE).toMatch(/fallback: true, reason: "listy"/);
    expect(ROUTE).toMatch(/fallback: true, reason: "rate"/);
  });
  it("정직성 시스템프롬프트 — 가격·SLA·고객사 단정 금지 / 2문장 / 숫자 지어내기 금지", () => {
    expect(ROUTE).toMatch(/가격\(금액\)·정확한 응답시간\(SLA\)·도입 기관명\/고객사/);
    expect(ROUTE).toMatch(/딱 2문장/);
    expect(ROUTE).toMatch(/숫자를 지어내지 않습니다/);
  });
  it("★ ontology 무접촉 — 제품 DB/실데이터 import·조회 0", () => {
    expect(ROUTE).not.toMatch(/from "@\/lib\/db"|prisma|db\.\w+\.(find|create|update|aggregate)/);
    expect(ROUTE).not.toMatch(/\/api\/(inventory|quotes|dashboard|orders)/);
  });
});

describe("§contact-redesign P2 — 클라이언트 wiring(라이브→폴백)", () => {
  it("도우미가 /api/support/ai-assist 호출", () => {
    expect(PAGE).toMatch(/fetch\("\/api\/support\/ai-assist"/);
  });
  it("실패/폴백 시 P1 룰베이스 큐레이션 복귀(항상 동작)", () => {
    expect(PAGE).toMatch(/toFallback/);
    expect(PAGE).toMatch(/classifyTopic\(q\)/);
  });
  it("라이브 성공=AI 답변 라벨 / 폴백=빠른 답변", () => {
    expect(PAGE).toMatch(/answer\.live \? "AI 답변" : "빠른 답변"/);
    expect(PAGE).toMatch(/live: true/);
    expect(PAGE).toMatch(/live: false/);
  });
  it("로딩 인디케이터(점 3개) + asking 게이트", () => {
    expect(PAGE).toMatch(/asking/);
    expect(PAGE).toMatch(/cp-dot/);
    expect(PAGE).toMatch(/disabled=\{!question\.trim\(\) \|\| asking\}/);
  });
});
