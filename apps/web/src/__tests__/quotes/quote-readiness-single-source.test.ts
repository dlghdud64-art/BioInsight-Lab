/**
 * §quote-readiness-single-source (릴레이 승인 2026-09-14) · 견적 준비 판정 단일 출처.
 *
 * ── 왜 ──
 * 2026-09-13 시뮬레이션: 토큰 회신 1건(₩70,000) 뒤 같은 견적을
 *   대시보드 브리핑  「차단 · 유효 견적 수 부족」 · 「구매 전환 불가」
 *   상세 페이지      「구매 전환: 가능」
 * 로 반대로 말했다. 단일 공급사 품목(항체 클론 · 세포주 · 전용 배지) 고객은 대시보드에서 멈춘다.
 *
 * 🛑 결함은 두 축이다 · 하나만 고치면 재발한다 (docs/plans/PLAN_quote-readiness-single-source.md)
 *   축 ① 판정 로직 3벌   dashboard deriveRailState · detail canConvert · quote-case-contract deriveUiState
 *   축 ② 회신 카운트 2벌  projectTokenReplies(QuoteResponse + 토큰 투영) vs vendorRequests RESPONDED
 *   → 카운트와 문턱을 **둘 다** resolveQuoteReadiness 한 함수가 가진다.
 *
 * 명제: 비교(회신 2건 이상)와 발주(회신 1건 이상)는 다른 축이다. 회신 1건은 "비교 불가" 이지 "차단" 이 아니다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 서버 전이 규칙(state-machine)은 회신 수 조건이 없다 · 화면 게이트만 본다(별건).
 *   2. 포털 회신(QuoteResponse)을 발주로 잇는 경로 · 지금은 세기만 하고 전환 대상에서 뺀다(별건).
 *   3. 전역 복사본 검사는 **형태**로 찾는다(회신 수를 `responses.length`·`*ResponseCount`·`*RespondedCount` 로 세서
 *      숫자 1·2 와 >=·<·<= 비교). 다음은 보지 않는다:
 *        · `respondedVendors.length > 1` 류 · 공급사가 여럿일 때 선택 UI 를 띄우는 표시 분기(판정 아님)
 *        · `=== 0` 회신 없음 분기(리마인더 대상 선정 등 · batch-reminder-sheet.tsx:195)
 *        · 목록에 없는 변수 이름으로 센 뒤 비교하는 형태
 *      2026-09-14 3a 판본은 변수 이름 목록(rc·responseCount…)으로만 찾아 `(selectedQuote.responses?.length ?? 0) >= 2`
 *      를 놓쳤다(릴레이 prod 측정이 드러냄) · "복사본 0" 은 **이 형태들에 대해** 0 이다.
 */
import { describe, it, expect } from "vitest";
import {
  COMPARE_MIN_RESPONSES,
  PO_MIN_RESPONSES,
  resolveQuoteReadiness,
  type QuoteReadinessInput,
} from "@/lib/quotes/readiness";

const vr = (id: string, status: "SENT" | "RESPONDED" | "EXPIRED", vendorName: string, items = 0) => ({
  id,
  status,
  vendorName,
  responseItemCount: items,
});
const input = (over: Partial<QuoteReadinessInput>): QuoteReadinessInput => ({
  status: "SENT",
  vendorRequests: [],
  portalResponses: [],
  isDelayed: false,
  ...over,
});

describe("§quote-readiness-single-source · 필수 명제", () => {
  it("🛑 회신 1건 → 발주 가능 · 비교 불가", () => {
    const r = resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "RESPONDED", "한국바이오", 1)] }));
    expect(r.respondedCount).toBe(1);
    expect(r.po.ready).toBe(true);
    expect(r.compare.ready).toBe(false);
    expect(r.summary).toBe("발주 가능 · 비교 불가");
    // 비교 축 상태는 유지하되 **차단이 아니다**
    expect(r.uiState).toBe("compare_not_ready");
    expect(r.blocked).toBe(false);
  });

  it("문턱은 한 곳 · 값 리터럴 고정 (비교 2 · 발주 1)", () => {
    expect(COMPARE_MIN_RESPONSES).toBe(2);
    expect(PO_MIN_RESPONSES).toBe(1);
  });
});

describe("§quote-readiness-single-source · 판정 행렬 (축 ①)", () => {
  it("회신 0건 → 둘 다 불가 · 회신 대기", () => {
    const r = resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "SENT", "A")] }));
    expect([r.respondedCount, r.po.ready, r.compare.ready, r.uiState]).toEqual([0, false, false, "awaiting_responses"]);
    expect(r.summary).toBe("발주 불가 · 비교 불가");
  });

  it("회신 0건 + 기한 경과 → 회신 지연", () => {
    const r = resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "SENT", "A")], isDelayed: true }));
    expect(r.uiState).toBe("response_delayed");
  });

  it("회신 2건 → 발주 가능 · 비교 가능", () => {
    const r = resolveQuoteReadiness(
      input({ status: "RESPONDED", vendorRequests: [vr("v1", "RESPONDED", "A", 1), vr("v2", "RESPONDED", "B", 1)] }),
    );
    expect([r.respondedCount, r.po.ready, r.compare.ready, r.uiState]).toEqual([2, true, true, "compare_review_required"]);
    expect(r.summary).toBe("발주 가능 · 비교 가능");
  });

  it("취소 견적은 회신이 있어도 발주 불가", () => {
    const r = resolveQuoteReadiness(input({ status: "CANCELLED", vendorRequests: [vr("v1", "RESPONDED", "A", 1)] }));
    expect(r.po.ready).toBe(false);
  });

  it("구매 진행 처리 완료(COMPLETED) → 발주 실행 단계 · 구매 전환은 이미 끝남", () => {
    const r = resolveQuoteReadiness(input({ status: "COMPLETED", vendorRequests: [vr("v1", "RESPONDED", "A", 1)] }));
    expect(r.uiState).toBe("ready_for_po_conversion");
    expect(r.po.ready).toBe(false);
  });

  it("발송 전(PENDING) → 요청 미발송", () => {
    expect(resolveQuoteReadiness(input({ status: "PENDING" })).uiState).toBe("request_not_sent");
  });
});

describe("§quote-readiness-single-source · 회신 카운트 단일 출처 (축 ②)", () => {
  it("토큰 폼 회신(responseItems)은 status 가 아직 SENT 여도 센다", () => {
    const r = resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "SENT", "A", 2)] }));
    expect(r.respondedCount).toBe(1);
    expect(r.convertibleCount).toBe(1);
  });

  it("요청자 수동 입력(RESPONDED · items 0)도 센다", () => {
    const r = resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "RESPONDED", "A", 0)] }));
    expect(r.respondedCount).toBe(1);
  });

  it("포털 회신(QuoteResponse)은 센다 · 발주 전환 대상은 아니다(vendorRequest 가 없다)", () => {
    const r = resolveQuoteReadiness(input({ portalResponses: [{ id: "qr1", vendorName: "C" }] }));
    expect(r.respondedCount).toBe(1);
    expect(r.convertibleCount).toBe(0);
    expect(r.po.ready).toBe(false);
  });

  it("같은 공급사가 포털과 요청 양쪽에 있으면 1건 (이름 공백 무시)", () => {
    const r = resolveQuoteReadiness(
      input({ vendorRequests: [vr("v1", "RESPONDED", "한국바이오", 1)], portalResponses: [{ id: "qr1", vendorName: " 한국바이오 " }] }),
    );
    expect(r.respondedCount).toBe(1);
  });

  it("목록 API 의 토큰 투영(id `vr:`)은 포털 회신으로 이중 계산하지 않는다", () => {
    const r = resolveQuoteReadiness(
      input({ vendorRequests: [vr("v1", "RESPONDED", "A", 1)], portalResponses: [{ id: "vr:v1", vendorName: "A" }] }),
    );
    expect(r.respondedCount).toBe(1);
    // 이름이 비어 있으면 이름 중복 제거가 못 걸러 준다 · id 규칙만으로 1건이어야 한다(대체 매칭 차단)
    const nameless = resolveQuoteReadiness(
      input({ vendorRequests: [vr("v1", "RESPONDED", "", 1)], portalResponses: [{ id: "vr:v1", vendorName: "" }] }),
    );
    expect(nameless.respondedCount).toBe(1);
  });

  it("토큰 투영만 있고 원본 vendorRequest 가 입력에 없으면 그 투영을 센다 (조용한 누락 금지)", () => {
    const r = resolveQuoteReadiness(input({ portalResponses: [{ id: "vr:v9", vendorName: "Z" }] }));
    expect(r.respondedCount).toBe(1);
  });

  it("만료(EXPIRED)이고 회신 흔적이 없으면 세지 않는다", () => {
    expect(resolveQuoteReadiness(input({ vendorRequests: [vr("v1", "EXPIRED", "A", 0)] })).respondedCount).toBe(0);
  });
});

// ── Phase 3 · 화면 연결 · 복사본 0 ────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { BLOCKING_UI_STATES } from "@/lib/quotes/readiness";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const DASH = "app/dashboard/quotes/page.tsx";
const DETAIL = "app/quotes/[id]/page.tsx";
const CONTRACT = "lib/quote-case-contract.ts";

describe("§quote-readiness-single-source · 두 화면이 같은 함수를 읽는다 (Phase 3)", () => {
  it("🛑 차단 상태 집합 · compare_not_ready 미포함 (리터럴 고정)", () => {
    expect([...BLOCKING_UI_STATES].sort()).toEqual(["condition_check_required", "external_approval_required"]);
    const dash = code(DASH);
    expect(dash).toMatch(/const BLOCKED_STATES: ReadonlySet<string> = BLOCKING_UI_STATES;/);
    expect(dash).not.toMatch(/BLOCKED_STATES = new Set\(\[[^\]]*compare_not_ready/);
  });

  it("대시보드 · deriveRailState 는 판정 함수에 위임하고 회신 1건 브리핑은 「발주 가능 · 비교 불가」", () => {
    const dash = code(DASH);
    expect(dash).toMatch(/import \{[^}]*\bresolveQuoteReadiness\b[^}]*\} from "@\/lib\/quotes\/readiness"/);
    expect(dash).toMatch(/function deriveRailState\(q: Quote\): RailState \{\s*return quoteReadiness\(q\)\.uiState;\s*\}/);
    const entry = dash.slice(dash.indexOf("compare_not_ready: {"), dash.indexOf("compare_review_required: {", dash.indexOf("compare_not_ready: {")));
    expect(entry).toMatch(/status: "발주 가능 · 비교 불가"/);
    expect(entry).toMatch(/blocker: "차단 없음"/);
    expect(entry).toMatch(/poReady: "가능"/);
  });

  it("대시보드 · 전환할 회신이 없으면 판정 결과로 덮어쓴다 (거짓 「가능」 금지)", () => {
    expect(code(DASH)).toMatch(/railState === "compare_not_ready" && !readiness\.po\.ready\s*\?\s*\{ \.\.\.base, badge: readiness\.summary, status: readiness\.summary/);
    // 전환할 회신이 없으면 주 동작도 추가 회신으로 되돌린다(구매 진행 버튼이 갈 곳이 없다)
    expect(code(DASH)).toMatch(/badge: readiness\.summary, status: readiness\.summary[^}]*ctaLabel: "추가 회신 확보"/);
  });

  it("🛑 대시보드 목록 행 · badge 와 주 동작이 상세와 같다 (3b · 행은 badge·CTA 를 그린다)", () => {
    const dash = code(DASH);
    const start = dash.indexOf("compare_not_ready: {");
    const entry = dash.slice(start, dash.indexOf("compare_review_required: {", start));
    expect(entry).toMatch(/badge: "발주 가능 · 비교 불가"/);
    expect(entry).toMatch(/ctaLabel: PO_DETAIL_CTA, railCtaLabel: PO_DETAIL_CTA/);
    expect(dash).toMatch(/const PO_DETAIL_CTA = "구매 진행";/);
    // 모듈 상수 RAIL_STATE_MAP 보다 먼저 선언(TDZ)
    expect(dash.indexOf('const PO_DETAIL_CTA = "구매 진행";')).toBeLessThan(dash.indexOf("compare_not_ready: {"));
  });

  /* 승계 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 원 제목 「행 CTA · 레일 CTA 2곳 각각」.
     레일(데스크톱·모바일 시트)이 삭제돼 구매 진행 CTA 는 행·카드 한 경로만 남았다. 명제(구매 진행 → 상세)는 불변.
     레일 CTA 가 되살아나면 그 자리도 상세로 가야 하므로 「0 이거나 상세」 가 아니라 **0** 을 단언한다(레일 부활 자체가 역계약 위반). */
  it("대시보드 · 구매 진행은 상세로 간다 (행·카드 CTA · 레일 CTA 0)", () => {
    const dash = code(DASH);
    expect(dash).toMatch(/if \(ctaLabel === PO_DETAIL_CTA\) \{\s*router\.push\(`\/quotes\/\$\{quoteId\}`\);\s*return;\s*\}/);
    expect(dash).not.toMatch(/selectedSignals\.ctaLabel === PO_DETAIL_CTA/);
  });

  it("상세 · canConvert 는 판정 함수의 발주 축 · 헤더 배지는 같은 요약", () => {
    const det = code(DETAIL);
    expect(det).toMatch(/import \{ resolveQuoteReadiness \} from "@\/lib\/quotes\/readiness"/);
    expect(det).toMatch(/const canConvert = readiness\.po\.ready;/);
    expect(det).toMatch(/\{canConvert && \([\s\S]{0,400}\{readiness\.summary\}/);
  });

  it("상세 · 받은 회신이 수동 입력 폼보다 먼저 보인다", () => {
    const det = code(DETAIL);
    const received = det.indexOf('<TabsContent value="received"');
    const list = det.indexOf("받은 회신 {respondedVendors.length}건", received);
    const form = det.indexOf("새 회신 직접 입력", received);
    expect(list).toBeGreaterThan(received);
    expect(form).toBeGreaterThan(list);
  });

  it("quote-case-contract · deriveUiState 는 위임만 한다", () => {
    const c = code(CONTRACT);
    const body = c.slice(c.indexOf("export function deriveUiState("), c.indexOf("export function derivePriorityScore("));
    expect(body).toMatch(/resolveQuoteReadiness\(/);
    expect(body).not.toMatch(/>=\s*2/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("§quote-readiness-single-source · 판정 복사본 0 (전역 · app·lib·components)", () => {
  it("🛑 회신 수 문턱을 화면에서 다시 쓰지 않는다", () => {
    const files = ["app", "lib", "components"].flatMap((d) => walk(join(SRC, d)));
    expect(files.length).toBeGreaterThan(1000); // 축이 비지 않았다
    const PATTERNS: [string, RegExp][] = [
      ["회신 수 변수 문턱 비교", /\b(rc|validQuotes|sqrc|\w*[Rr]esponseCount|\w*[Rr]espondedCount)\s*(>=|<=|<)\s*[12]\b/],
      ["responses.length 직접 문턱 비교", /responses\??\.length(\s*\?\?\s*0\))?\s*(>=|<=|<)\s*[12]\b/],
      ["비교 상태 삼항 복사", /"compare_review_required"\s*:\s*"compare_not_ready"/],
    ];
    const hits: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f).replace(/\\/g, "/");
      if (rel === "lib/quotes/readiness.ts") continue;
      const c = stripComments(readFileSync(f, "utf8"));
      for (const [label, re] of PATTERNS) if (re.test(c)) hits.push(`${rel} · ${label}`);
    }
    expect(hits).toEqual([]);
  });
});
