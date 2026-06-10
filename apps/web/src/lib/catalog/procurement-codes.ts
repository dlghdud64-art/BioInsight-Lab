// §catalog-A Phase 4 — 분류 코드 해석 (호영님 P1, 2026-06-10)
// Phase 0은 카운트만 실측(Seg12 123 / Seg41 985) — 8자리 실코드 미보유.
// 날조 금지 → 검증된 세그먼트만 고정, 8자리 코드는 런타임 Unit8 range로 해석.

import { parseProcurementResponse } from "@/lib/catalog/procurement-ingest";

const API_BASE = "https://apis.data.go.kr/1230000/ao/ThngListInfoService";
const UNIT8_OP = "getPrdctClsfcNoUnit8Info"; // Phase 0 §4-b 실측 검증 endpoint

/** Phase 0 검증 세그먼트 — 12=화학·시약, 41=실험·측정·시험장비 */
export const CATALOG_INGEST_SEGMENTS = ["12", "41"] as const;
export type CatalogSegment = (typeof CATALOG_INGEST_SEGMENTS)[number];

export interface Unit8RangeParams {
  serviceKey: string;
  segment: CatalogSegment;
  pageNo: number;
  numOfRows: number;
}

/** 세그먼트(2자리) → 8자리 범위 [SS000000, SS999999] Unit8 조회 URL */
export function buildUnit8RangeUrl(p: Unit8RangeParams): string {
  const q = new URLSearchParams({
    serviceKey: p.serviceKey,
    pageNo: String(p.pageNo),
    numOfRows: String(p.numOfRows),
    type: "json",
    prdctClsfcNoBgnNo: `${p.segment}000000`,
    prdctClsfcNoEndNo: `${p.segment}999999`,
  });
  return `${API_BASE}/${UNIT8_OP}?${q.toString()}`;
}

interface Unit8Item {
  prdctClsfcNo?: string | null;
}

export interface ParsedCodes {
  codes: string[];
  totalCount: number;
}

/**
 * Unit8 응답 → 8자리 코드 목록. resultCode 00 강제(parseProcurementResponse 재사용),
 * 세그먼트 prefix 불일치 코드는 방어적 제외.
 */
export function parseUnit8Codes(json: unknown, segment: CatalogSegment): ParsedCodes {
  const parsed = parseProcurementResponse(json);
  const codes = (parsed.items as Unit8Item[])
    .map((i) => (i.prdctClsfcNo ?? "").trim())
    .filter((c) => /^\d{8}$/.test(c) && c.startsWith(segment));
  return { codes, totalCount: parsed.totalCount };
}
