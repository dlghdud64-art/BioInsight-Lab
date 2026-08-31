/**
 * §scan-recognition-upgrade P1 — COA 추출·라인 대조 순수함수.
 *
 * 신규 파서 0 — 추출은 기존 라벨 앵커(label-parser: LOT/EXPIRY/CATALOG 패턴)를
 * parseReagentLabel 로 그대로 재사용한다. 이 모듈이 더하는 것은
 *   1) COA 문서 전용 품명 앵커(품명:/Product:) 1개
 *   2) 라인 대조(ok|mismatch|unknown) 순수함수
 * 뿐이다. 대조 결과는 표시용 파생 — 자동 선택·자동 확정·저장 0.
 * 실패 필드 = null (빈값 폴백 — 지어내지 않는다).
 */

import { parseReagentLabel, type LabelParseResult } from "./label-parser";

export interface CoaFields {
  lot: string | null;
  expiry: string | null; // YYYY-MM-DD (label-parser normalizeDate 승계)
  catalogNo: string | null;
  productName: string | null;
}

export type CoaLineMatch = "ok" | "mismatch" | "unknown";

export interface CoaLineResult {
  itemId: string;
  match: CoaLineMatch;
}

/** POST /api/receiving-drafts/[id]/coa-recognize 응답 계약 (저장 0 · 표시용 파생). */
export interface CoaRecognitionResponse {
  jobId: string | null;
  fields: CoaFields;
  confidence: "high" | "medium" | "low";
  perLine: CoaLineResult[];
}

/** COA 문서 전용 품명 앵커 — 라벨 휴리스틱보다 우선(성적서 표제행 오인 방지). */
const COA_PRODUCT_ANCHOR = /(?:product|품명|제품명)\s*[:=]\s*(.+)/i;

/** 파이프라인 결과(LabelParseResult) → COA 필드 사영. route 가 쓴다. */
export function coaFieldsFromLabel(result: LabelParseResult): CoaFields {
  return {
    lot: result.lotNo,
    expiry: result.expirationDate,
    catalogNo: result.catalogNo,
    productName: result.productName,
  };
}

/** raw text → COA 필드 (기존 앵커 재사용 + 품명 앵커 우선). */
export function extractCoaFields(rawText: string): CoaFields {
  const parsed = parseReagentLabel(rawText);
  const anchored = rawText.match(COA_PRODUCT_ANCHOR)?.[1]?.trim() ?? null;
  return {
    lot: parsed.lotNo,
    expiry: parsed.expirationDate,
    catalogNo: parsed.catalogNo,
    productName: anchored || parsed.productName,
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

/** 라인명 안의 catalog 형 토큰 (Sigma 스타일 등) — mismatch 판정 근거. */
const CATALOG_TOKEN = /\b([A-Z]{1,3}\d{3,6}-\d+[A-Z]{0,2})\b/;

function matchLine(fields: CoaFields, itemName: string): CoaLineMatch {
  const nameNorm = norm(itemName);
  if (fields.catalogNo) {
    if (nameNorm.includes(norm(fields.catalogNo))) return "ok";
    const token = itemName.match(CATALOG_TOKEN)?.[1];
    if (token && norm(token) !== norm(fields.catalogNo)) return "mismatch";
  }
  if (fields.productName) {
    const tokens = fields.productName
      .split(/\s+/)
      .map(norm)
      .filter((t) => t.length >= 3);
    if (tokens.some((t) => nameNorm.includes(t))) return "ok";
  }
  return "unknown";
}

/**
 * 라인별 대조 — 라인마다 독립 판정. 자동 선택 축 없음(shape = itemId·match 뿐).
 * mismatch 는 경고 표시용이지 차단이 아니다(사람 판단 — 핸드오프 §3).
 */
export function matchCoaToLines(
  fields: CoaFields,
  items: { id: string; name: string }[],
): CoaLineResult[] {
  return items.map((it) => ({ itemId: it.id, match: matchLine(fields, it.name) }));
}
