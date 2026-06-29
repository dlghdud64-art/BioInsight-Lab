/**
 * §brief-realdata-quotes (호영님 2026-06-29) — 운영 브리핑 quotes 실데이터 연동(pilot)
 *
 * 결정: LIVE 브리핑 = quote_response_pending 1종(SENT 견적 = 공급사 응답 대기)만.
 *   - 죽은 카드(발주 생성/리마인더 = 발주 제거 / 3사 비교표 = QuoteComparison 모델 없음) LIVE 미렌더.
 *   - 발주/입고/재고 모듈 0(미조회 — 가짜 채우기 0).
 *   - 어댑터: 실 DB SENT만 → contract 'sent' → buildInboxFromQuotes(…, []) 재사용(due/priority/triage canonical).
 *   - RESPONDED("응답 완료")는 "응답 대기"로 표기 안 함(거짓 금지) → 제외.
 *   - 신규 백엔드 = GET 라우트 1개(읽기 전용). 통보 발송 = 기존 PATCH.
 *   - LIVE 플립으로 데모 배지 제거 + 견적 통보 활성화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const ADAPTER = read("lib/operational-brief/real-quote-inbox.ts");
const ROUTE = read("app/api/operational-brief/inbox/route.ts");
const POPUP = read("components/operational-brief/popup.tsx");

describe("§brief-realdata-quotes — 어댑터(실 Quote → inbox, honesty)", () => {
  it("buildRealQuoteInbox export + db.quote.findMany SENT 스코프", () => {
    expect(ADAPTER).toMatch(/export async function buildRealQuoteInbox/);
    expect(ADAPTER).toMatch(/db\.quote\.findMany/);
    expect(ADAPTER).toMatch(/status:\s*QuoteStatus\.SENT/);
  });
  it("SENT만 매핑 → contract status 'sent'(응답 대기)", () => {
    expect(ADAPTER).toMatch(/status:\s*"sent"/);
  });
  it("buildInboxFromQuotes 재사용 + comparisons=[] (비교 검토 아이템 미생성·drift 0)", () => {
    expect(ADAPTER).toMatch(/buildInboxFromQuotes\(reqs,\s*resps,\s*\[\]\)/);
  });
  it("userId 스코프(본인 견적)", () => {
    expect(ADAPTER).toMatch(/where:\s*\{\s*userId/);
  });
});

describe("§brief-realdata-quotes — API 라우트(읽기 전용)", () => {
  it("GET export + auth 401 가드", () => {
    expect(ROUTE).toMatch(/export async function GET/);
    expect(ROUTE).toMatch(/await auth\(\)/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });
  it("buildRealQuoteInbox(session.user.id) 호출 + items 반환", () => {
    expect(ROUTE).toMatch(/buildRealQuoteInbox\(session\.user\.id\)/);
    expect(ROUTE).toMatch(/items/);
  });
});

describe("§brief-realdata-quotes — popup LIVE 연동", () => {
  it("BRIEF_DATA_IS_LIVE = true (플립)", () => {
    expect(POPUP).toMatch(/const BRIEF_DATA_IS_LIVE = true;/);
  });
  it("LIVE 시 실 inbox endpoint fetch", () => {
    expect(POPUP).toContain('fetch("/api/operational-brief/inbox")');
  });
  it("allItems = LIVE ? 실데이터 : 시드(시드 store 불침범)", () => {
    expect(POPUP).toContain("const seedInbox = useMemo(");
    expect(POPUP).toMatch(/const allItems = BRIEF_DATA_IS_LIVE \? \(liveItems \?\? \[\]\) : seedInbox;/);
  });
  it("로딩/에러 상태 정직", () => {
    expect(POPUP).toContain("불러오는 중");
    expect(POPUP).toContain("운영 브리핑을 불러오지 못했습니다");
  });
});

describe("§brief-realdata-quotes — 보존(회귀 0)", () => {
  it("견적 통보(실 PATCH)·미리보기 보존 — LIVE 활성", () => {
    expect(POPUP).toMatch(/BRIEF_DATA_IS_LIVE \? \([\s\S]{0,120}<QuoteNotifyAction/);
    expect(POPUP).toContain("확인하고 발송");
  });
  it("데모 배지 코드 보존(flip-safe — !LIVE 게이트)", () => {
    expect(POPUP).toMatch(/!BRIEF_DATA_IS_LIVE && \(/);
    expect(POPUP).toContain("데모 데이터");
  });
  it("track-3 dismiss/idle 보존", () => {
    expect(POPUP).toContain("오늘 숨김");
    expect(POPUP).toContain("4개 모듈을 모니터링");
  });
});
