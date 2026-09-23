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
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const ADAPTER = read("lib/operational-brief/real-quote-inbox.ts");
const ROUTE = read("app/api/operational-brief/inbox/route.ts");
const POPUP = read("components/operational-brief/popup.tsx");
const FETCHER = read("lib/operational-brief/fetch-real-inbox.ts");
/** 부정 단언은 주석 제거본에 — 폐기 사유를 적은 주석이 스스로 걸리지 않도록 */
const POPUP_CODE = stripComments(POPUP);

describe("§brief-realdata-quotes · 어댑터(실 Quote → inbox, honesty)", () => {
  it("buildRealQuoteInbox export + db.quote.findMany SENT+RESPONDED 스코프", () => {
    expect(ADAPTER).toMatch(/export async function buildRealQuoteInbox/);
    expect(ADAPTER).toMatch(/db\.quote\.findMany/);
    // §brief-realdata-responded — SENT(응답 대기) + RESPONDED(응답 도착) 둘 다.
    expect(ADAPTER).toMatch(/QuoteStatus\.SENT,\s*QuoteStatus\.RESPONDED/);
  });
  it("SENT → contract status 'sent'(응답 대기)", () => {
    expect(ADAPTER).toMatch(/status:\s*"sent"/);
  });
  it("buildInboxFromQuotes 재사용 + comparisons=[] (비교 검토 아이템 미생성·drift 0)", () => {
    expect(ADAPTER).toMatch(/buildInboxFromQuotes\(reqs,\s*resps,\s*\[\]\)/);
  });
  it("§brief-realdata-responded · RESPONDED → quote_review_required 직접 emit(canonical 재사용)", () => {
    expect(ADAPTER).toMatch(/q\.status === QuoteStatus\.RESPONDED/);
    expect(ADAPTER).toMatch(/workType:\s*"quote_review_required"/);
    expect(ADAPTER).toContain("응답 도착");
    expect(ADAPTER).toMatch(/resolveDueState\(/);
    expect(ADAPTER).toMatch(/calculateInboxPriority\(item\)/);
    expect(ADAPTER).toMatch(/sortInboxItems\(/);
  });
  it("§brief-realdata-orgscope · 본인 OR 소속 조직 견적(detail/PATCH 권한 정합)", () => {
    expect(ADAPTER).toMatch(/db\.organizationMember\.findMany/);
    expect(ADAPTER).toMatch(/OR:\s*\[/);
    expect(ADAPTER).toMatch(/\{ userId \}/);
    expect(ADAPTER).toMatch(/organizationId:\s*\{ in: orgIds \}/);
  });
});

describe("§brief-realdata-quotes · API 라우트(읽기 전용)", () => {
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

describe("§brief-realdata-quotes · popup LIVE 연동", () => {
  // §inbox-seed-cutoff (2026-09-22 · 호영님 판정) — 승계: 플래그·시드 폴백은 제거됐고, 명제는 그대로다.
  //   "브리핑 목록 = 실데이터만" · 시드가 사라져도 이 명제는 살아 있어야 한다.
  it("목록은 실데이터만 · 시드 폴백·플래그 0 (역계약 · 주석 제거본)", () => {
    expect(POPUP).toMatch(/const allItems = liveItems \?\? \[\];/);
    expect(POPUP_CODE).not.toMatch(/\bBRIEF_DATA_IS_LIVE\b/);
    expect(POPUP_CODE).not.toMatch(/\bseedInbox\b/);
    expect(POPUP_CODE).not.toMatch(/\buseOpsStore\b/);
    expect(POPUP_CODE).not.toMatch(/\bbuildFullInbox\b/);
  });
  it("실 inbox endpoint 는 /dashboard/inbox 와 같은 함수로 부른다", () => {
    expect(POPUP).toContain("fetchRealInboxItems()");
    expect(FETCHER).toContain('export const REAL_INBOX_ENDPOINT = "/api/operational-brief/inbox"');
  });
  it("로딩/에러 상태 정직", () => {
    expect(POPUP).toContain("불러오는 중");
    expect(POPUP).toContain("운영 브리핑을 불러오지 못했습니다");
  });
  it("§brief-realdata-refetch · 발송 후 inbox 재조회(context 트리거)", () => {
    expect(POPUP).toContain("BriefRefetchContext");
    expect(POPUP).toMatch(/setRefreshKey\(\(k\) => k \+ 1\)/);
    expect(POPUP).toMatch(/\}, \[isOpen, refreshKey\]\);/);
    expect(POPUP).toMatch(/setTimeout\(\(\) => refetchInbox\(\), 2000\)/);
  });
});

describe("§brief-realdata-quotes · 보존(회귀 0)", () => {
  it("견적 통보(실 PATCH)·미리보기 보존", () => {
    expect(POPUP).toContain("<QuoteNotifyAction");
    expect(POPUP).toContain("확인하고 발송");
  });
  it("§inbox-seed-cutoff · 시드용 「데모 데이터」 배지·통보 차단 분기 0 (도달 0 이던 죽은 코드)", () => {
    expect(POPUP_CODE).not.toMatch(/데모 데이터/);
    // 견적 통보는 조건 없이 활성 (예전엔 플래그 분기 안에 있었다)
    expect(POPUP).toMatch(/brief\.module === "quote" && <QuoteNotifyAction quoteId=\{item\.entityId\} \/>/);
  });
  it("track-3 dismiss/idle 보존", () => {
    expect(POPUP).toContain("오늘 숨김");
    expect(POPUP).toContain("4개 모듈을 모니터링");
  });
});
