/**
 * §pricing-assistant + §pricing-고도화 — AI 즉답 카드 + 무료체험 pill + 결제주기 + 스크롤바
 * (호영님 2026-06-27)
 *
 * AI 카드 = 실 백엔드(/api/pricing-assistant → 공유 LLM 래퍼 callAnthropicMessage), 키 없음/에러 = 항상 200+폴백(5xx 금지).
 * 무료체험 pill = descriptor.trialEligible(Basic) 재사용. 결제주기 라인 = annualBilling. 스크롤 진행바.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

describe("§pricing-assistant — 실 백엔드(항상 200+폴백)", () => {
  const ROUTE = read("src/app/api/pricing-assistant/route.ts");
  // 주석 strip — 설명 주석의 "window.claude" 언급이 not.toMatch 오탐 내지 않도록.
  const ROUTE_CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  it("공유 LLM 래퍼 경유(callAnthropicMessage) — provider/키 추상화", () => {
    // §pricing-assistant-fix — 직접 @anthropic-ai/sdk + raw ANTHROPIC_API_KEY 우회 폐기.
    //   (LABAXIS_AI_PROVIDER=openai 등 환경/키 변수 불일치 시 항상 폴백되던 버그.) 래퍼가 키/provider 해석.
    expect(ROUTE_CODE).toMatch(/callAnthropicMessage/);
    expect(ROUTE_CODE).toMatch(/from "@\/lib\/ai\/anthropic"/);
    expect(ROUTE_CODE).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
    expect(ROUTE_CODE).not.toMatch(/NEXT_PUBLIC_/);
  });
  it("키 없음/에러 = 200 + 폴백(5xx 금지, window.claude 아님)", () => {
    expect(ROUTE).toMatch(/catch\s*(?:\([^)]*\))?\s*\{[\s\S]*?return NextResponse\.json\(\{ answer: FB\[fbKey\] \}, \{ status: 200 \}\)/);
    expect(ROUTE_CODE).not.toMatch(/window\.claude/);
    expect(ROUTE_CODE).not.toMatch(/status: 5\d\d/);
  });
  it("인젝션·과금 방어(slice 400) + 2문장 강제(max_tokens 작게) + clean", () => {
    expect(ROUTE).toMatch(/\.slice\(0, 400\)/);
    expect(ROUTE).toMatch(/maxTokens: 220/);
    expect(ROUTE).toMatch(/const clean = /);
  });
  it("SYSTEM 가격 SSOT 정합(89,000 / 259,000)", () => {
    expect(ROUTE).toMatch(/89,000/);
    expect(ROUTE).toMatch(/259,000/);
  });
});

describe("§pricing-assistant — 클라이언트 카드 + 페이지 삽입", () => {
  const COMP = read("src/app/pricing/_components/pricing-assistant.tsx");
  const PAGE = read("src/app/pricing/page.tsx");
  it("카드가 /api/pricing-assistant 실 호출 + 폴백 텍스트", () => {
    expect(COMP).toMatch(/fetch\("\/api\/pricing-assistant"/);
    expect(COMP).toMatch(/AI에게 바로 물어보기/);
    expect(COMP).toMatch(/AI 답변은 참고용입니다/);
  });
  it("페이지가 AI 카드 + 정적 FAQ 둘 다 렌더(아코디언 보존)", () => {
    expect(PAGE).toMatch(/<PricingAssistant \/>/);
    expect(PAGE).toMatch(/FAQ_DATA\.map/);
  });
});

describe("§pricing-고도화 — 무료체험 미노출(honesty) + 결제주기 라인", () => {
  const PAGE = read("src/app/pricing/page.tsx");
  // 호영님 결정 — 무료체험 pill 보류: trial-START 결제 백엔드 부재 → 노출 시 fake claim(§pricing-prelaunch 불변).
  //   trialEligible 데이터 플래그는 유지하되 "1개월 무료체험" 문구는 노출 0. 실노출은 §pricing-billing-backend 후.
  it("무료체험 문구 미노출(fake claim 0) — pricing-prelaunch 불변", () => {
    // 주석 strip — "무료체험 pill 보류" 기록 주석이 오탐 내지 않도록 렌더 코드만 검사.
    const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(PAGE_CODE).not.toMatch(/무료 ?체험/);
  });
  it("결제주기 라인 = annualBilling(월간↔연간) + Free/Custom 제외", () => {
    expect(PAGE).toMatch(/annualBilling \? <>연간 결제/);
    expect(PAGE).toMatch(/price !== "Free" && price !== "Custom"/);
    expect(PAGE).toMatch(/annualBilling=\{annual\}/);
  });
});

describe("§pricing-고도화 — 상단 스크롤 진행바", () => {
  const SP = read("src/app/pricing/_components/scroll-progress.tsx");
  const PAGE = read("src/app/pricing/page.tsx");
  it("스크롤 비율 width% + 페이지 배치", () => {
    expect(SP).toMatch(/scrollTop \/ max/);
    expect(SP).toMatch(/fixed top-0/);
    expect(PAGE).toMatch(/<ScrollProgress \/>/);
  });
});
