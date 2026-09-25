/**
 * §quote-readiness-single-source (릴레이 승인 2026-09-14) · 견적 준비 판정 **단일 출처**.
 *
 * 🛑 두 축을 한 함수가 가진다 · 하나만 합치면 재발한다 (docs/plans/PLAN_quote-readiness-single-source.md)
 *   축 ① 판정  비교(회신 ≥ COMPARE_MIN_RESPONSES)와 발주(회신 ≥ PO_MIN_RESPONSES)는 **다른 축**이다.
 *              회신 1건은 "비교 불가" 이지 "차단" 이 아니다.
 *   축 ② 카운트 회신을 쓰는 경로 3개를 모두 한 규칙으로 센다.
 *              토큰 폼(vendorRequest + responseItems) · 요청자 수동 입력(vendorRequest RESPONDED) ·
 *              공급사 포털(QuoteResponse · vendorRequest 없음)
 *
 * 화면에서 `rc >= 2 ?` · `respondedCount >= 1 &&` 같은 판정을 다시 쓰지 말 것.
 *   2026-09-13 대시보드는 2건 문턱으로 「차단」, 상세는 1건 문턱으로 「가능」 을 말했다.
 *   regression 센티널이 app·lib·components 전역에서 복사본 0 을 본다.
 *
 * 순수 함수 · 저장 0 · DB 접근 0. 입력은 호출부가 정규화해서 넘긴다.
 */
import type { QuoteCaseUiState } from "@/lib/quote-case-contract";

/** 비교 검토에 필요한 회신 수. */
export const COMPARE_MIN_RESPONSES = 2;
/** 구매 전환(발주 진행)에 필요한 회신 수. 단일 공급사 품목은 1건이 정상이다. */
export const PO_MIN_RESPONSES = 1;

export interface ReadinessVendorRequest {
  id: string;
  status: string;
  vendorName?: string | null;
  /** 토큰 폼·수동 입력이 남긴 품목별 회신 행 수 */
  responseItemCount?: number;
}

export interface ReadinessPortalResponse {
  id: string;
  vendorName?: string | null;
}

export interface QuoteReadinessInput {
  status: string;
  vendorRequests: ReadinessVendorRequest[];
  /** 공급사 포털 회신(QuoteResponse). 목록 API 가 합류시킨 토큰 투영(id `vr:`)이 섞여 있어도 된다 · 여기서 거른다. */
  portalResponses: ReadinessPortalResponse[];
  /** 납기 희망일 경과 여부(회신 0건일 때 지연 표기) */
  isDelayed?: boolean;
}

export interface ReadinessAxis {
  ready: boolean;
  label: string;
}

export interface QuoteReadiness {
  /** 회신한 공급사 수(포털 포함 · 공급사 기준 중복 제거) */
  respondedCount: number;
  /**
   * 회신을 **요청한** 공급사 수 = 회신 수의 분모.
   *
   * §quote-reply-denominator (2026-09-25 · 호영님 판정) — 화면들이 분모로 **품목 수**(items.length)를 쓰고 있었다.
   *   「회신 1/1」 이 말하는 것은 「보낸 공급사 중 몇 곳이 답했나」 인데,
   *   품목 3개를 공급사 1곳에 보내고 답을 받으면 「1/3」 이 나왔다.
   *   prod 견적이 전부 1품목이라 **우연히** 맞아 보였을 뿐이다(호영님).
   *   RFQ 를 여러 곳에 돌려 추적하는 것이 지금 파는 기능이므로 가장 먼저 참이어야 하는 숫자다.
   *
   * vendorRequest 없이 포털로만 들어온 회신은 초대 행이 없으므로 분모에도 더한다
   * — 그래야 respondedCount ≤ invitedCount 가 언제나 성립한다.
   */
  invitedCount: number;
  /** 구매 전환에 쓸 수 있는 회신 수(vendorRequest 가 있는 회신만) */
  convertibleCount: number;
  compare: ReadinessAxis;
  po: ReadinessAxis;
  /** 화면 공통 한 줄 요약 · 예: 「발주 가능 · 비교 불가」 */
  summary: string;
  uiState: QuoteCaseUiState;
  /** 진짜 차단(조건·승인)만 true · 비교 불가는 차단이 아니다 */
  blocked: boolean;
}

/**
 * 진짜 차단 상태 · 조건·승인이 풀려야 다음으로 간다. 🛑 compare_not_ready 를 넣지 말 것 ·
 * 회신 1건은 비교만 불가이고 발주는 가능하다(2026-09-13 시뮬레이션 결함의 뿌리).
 */
export const BLOCKING_UI_STATES: ReadonlySet<QuoteCaseUiState> = new Set<QuoteCaseUiState>([
  "condition_check_required",
  "external_approval_required",
]);

const norm = (s: string | null | undefined) => (s ?? "").trim();

function hasResponded(v: ReadinessVendorRequest): boolean {
  return v.status === "RESPONDED" || (v.responseItemCount ?? 0) > 0;
}

export function resolveQuoteReadiness(input: QuoteReadinessInput): QuoteReadiness {
  const responded = input.vendorRequests.filter(hasResponded);
  const respondedIds = new Set(responded.map((v) => v.id));
  const respondedNames = new Set(responded.map((v) => norm(v.vendorName)).filter((n) => n.length > 0));

  const portalOnly = new Map<string, ReadinessPortalResponse>();
  for (const p of input.portalResponses) {
    // 목록 API 의 토큰 투영(id `vr:<vendorRequestId>`) · 원본 vendorRequest 가 입력에 있으면 이미 셌다
    if (p.id.startsWith("vr:") && respondedIds.has(p.id.slice(3))) continue;
    if (respondedIds.has(p.id)) continue;
    const name = norm(p.vendorName);
    if (name && respondedNames.has(name)) continue;
    portalOnly.set(name || `id:${p.id}`, p);
  }

  const respondedCount = responded.length + portalOnly.size;
  const convertibleCount = responded.length;
  const closed = input.status === "CANCELLED" || input.status === "COMPLETED" || input.status === "PURCHASED";

  const poReady = !closed && convertibleCount >= PO_MIN_RESPONSES;
  const compareReady = input.status !== "CANCELLED" && respondedCount >= COMPARE_MIN_RESPONSES;

  let uiState: QuoteCaseUiState;
  if (input.status === "COMPLETED") uiState = "ready_for_po_conversion";
  else if (input.status === "RESPONDED" || input.status === "SENT") {
    if (respondedCount === 0) uiState = input.isDelayed ? "response_delayed" : "awaiting_responses";
    else uiState = respondedCount >= COMPARE_MIN_RESPONSES ? "compare_review_required" : "compare_not_ready";
  } else uiState = "request_not_sent";

  const poLabel = poReady ? "발주 가능" : "발주 불가";
  const compareLabel = compareReady ? "비교 가능" : "비교 불가";

  const invitedCount = input.vendorRequests.length + portalOnly.size;

  return {
    respondedCount,
    invitedCount,
    convertibleCount,
    po: { ready: poReady, label: poLabel },
    compare: { ready: compareReady, label: compareLabel },
    summary: `${poLabel} · ${compareLabel}`,
    uiState,
    blocked: BLOCKING_UI_STATES.has(uiState),
  };
}
