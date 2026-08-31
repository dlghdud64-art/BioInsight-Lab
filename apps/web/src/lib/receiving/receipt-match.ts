/**
 * §scan-recognition-upgrade P2 — 명세서↔발주 근사 매칭 순수함수.
 *
 * 입력은 파싱된 명세서(공급사·문서 번호·품목/수량)와 후보 발주 목록.
 * 출력은 **정렬된 후보 목록 또는 { mode: "new" } 뿐** — 자동 선택 축 없음
 * (선택은 사람, 연결 강제 0 — 핸드오프 §3).
 *
 * 점수축(임계 3):
 *   · PO 번호: 정규화 일치 +3 · 존재+불일치 -3 · **파싱값 없으면 감점 0**
 *   · 공급사명: 법인 접미((주)·주식회사·Co./Ltd./Inc./Corp)·공백·대소문자 무시 일치 +2
 *   · 품목: 토큰 Jaccard ≥ 0.5 인 라인 비율 × 2
 *   · 수량: 매칭 라인 중 ±20% 이내 비율 × 1
 */

export interface ParsedReceiptForMatch {
  vendorName: string | null;
  /** 파싱된 문서/PO 번호 — 있을 때만 대조 */
  orderNumber: string | null;
  items: { name: string; quantity: number }[];
}

export interface OrderCandidateForMatch {
  orderId: string;
  orderNumber: string;
  vendorName: string | null;
  items: { name: string; quantity: number }[];
}

export interface ScoredOrderCandidate {
  orderId: string;
  orderNumber: string;
  score: number;
}

export type ReceiptMatchResult =
  | { mode: "matched"; candidates: ScoredOrderCandidate[] }
  | { mode: "new" };

const SCORE_THRESHOLD = 3;

/** 법인 접미·공백·특수문자 제거 + 소문자 — 공급사명 정규화. */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(주\)|주식회사|㈜|co\.?,?\s*ltd\.?|ltd\.?|inc\.?|corp\.?|company/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function normalizeOrderNumber(no: string): string {
  return no.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function scoreCandidate(
  parsed: ParsedReceiptForMatch,
  cand: OrderCandidateForMatch,
): number {
  let score = 0;

  // PO 번호 — 있을 때만 대조(없으면 감점 0).
  if (parsed.orderNumber) {
    score +=
      normalizeOrderNumber(parsed.orderNumber) === normalizeOrderNumber(cand.orderNumber)
        ? 3
        : -3;
  }

  // 공급사명 정규화 일치.
  if (
    parsed.vendorName &&
    cand.vendorName &&
    normalizeVendorName(parsed.vendorName) !== "" &&
    normalizeVendorName(parsed.vendorName) === normalizeVendorName(cand.vendorName)
  ) {
    score += 2;
  }

  // 품목 토큰 Jaccard ≥ 0.5 매칭 비율 + 매칭 라인 수량 ±20% 비율.
  if (parsed.items.length > 0) {
    let matched = 0;
    let qtyOk = 0;
    for (const it of parsed.items) {
      const itTokens = tokens(it.name);
      let best: { j: number; qty: number } | null = null;
      for (const ci of cand.items) {
        const j = jaccard(itTokens, tokens(ci.name));
        if (j >= 0.5 && (!best || j > best.j)) best = { j, qty: ci.quantity };
      }
      if (best) {
        matched += 1;
        if (best.qty > 0 && Math.abs(it.quantity - best.qty) / best.qty <= 0.2) qtyOk += 1;
      }
    }
    score += (matched / parsed.items.length) * 2;
    score += qtyOk / parsed.items.length;
  }

  return score;
}

export function matchReceiptToOrders(
  parsed: ParsedReceiptForMatch,
  candidates: OrderCandidateForMatch[],
): ReceiptMatchResult {
  const scored = candidates
    .map((c) => ({ orderId: c.orderId, orderNumber: c.orderNumber, score: scoreCandidate(parsed, c) }))
    .filter((c) => c.score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { mode: "new" };
  return { mode: "matched", candidates: scored };
}
