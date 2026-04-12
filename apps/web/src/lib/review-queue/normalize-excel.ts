/**
 * 엑셀 업로드 결과 → Review Queue Item normalize + column mapping + status mapping
 *
 * 엑셀 행 1개를 ReviewQueueItem으로 변환한다.
 * sourceType은 항상 "excel".
 */

import type {
  ReviewQueueItem,
  ReviewStatus,
  ConfidenceLevel,
  MatchCandidate,
} from "./types";

// ── 컬럼 역할 ──
export type ColumnRole =
  | "item_name"
  | "manufacturer"
  | "catalog_number"
  | "spec"
  | "quantity"
  | "unit"
  | "note"
  | "location"
  | "project"
  | "team"
  | "budget_code"
  | "skip";

// ── 컬럼 매핑 결과 ──
export interface ColumnMapping {
  columnIndex: number;
  headerText: string;
  role: ColumnRole;
  confidence: "auto" | "manual";
}

// ── 엑셀 파싱 컨텍스트 ──
export interface ExcelParseContext {
  fileName: string;
  sheetName: string;
  headerRowIndex: number;
  columnMappings: ColumnMapping[];
}

// ── 엑셀 행 데이터 ──
export interface ExcelRow {
  rowIndex: number;
  cells: (string | number | null)[];
}

// ── 엑셀 source 전용 메타 ──
export interface ExcelSourceMeta {
  sourceFileName: string;
  sheetName: string;
  rowIndex: number;
  originalRow: Record<string, string | number | null>;
  mappedColumns: Record<ColumnRole, string | null>;
  rawCells: (string | number | null)[];
}

// ── ID 생성 ──
function generateExcelQueueId(fileName: string, sheetName: string, rowIndex: number): string {
  const hash = Math.random().toString(36).slice(2, 6);
  return `excel-${hash}-${sheetName}-r${rowIndex}`;
}

// ── Header 자동 인식 키워드 매핑 ──
const COLUMN_KEYWORDS: Record<ColumnRole, string[]> = {
  item_name: ["품목", "품명", "시약명", "제품명", "item", "product", "name", "시약", "제품"],
  manufacturer: ["제조사", "브랜드", "brand", "manufacturer", "메이커", "회사"],
  catalog_number: ["catalog", "cat no", "cat.no", "품번", "카탈로그번호", "카탈로그", "cat#", "제품번호"],
  spec: ["규격", "용량", "size", "spec", "포장", "사양", "volume"],
  quantity: ["수량", "qty", "quantity", "개수", "주문수량", "요청수량"],
  unit: ["단위", "unit", "포장단위"],
  note: ["비고", "note", "memo", "메모", "참고"],
  location: ["위치", "보관", "location", "저장"],
  project: ["프로젝트", "project", "과제"],
  team: ["부서", "팀", "team", "dept"],
  budget_code: ["예산", "budget", "예산코드", "과목"],
  skip: [],
};

// ── Header row 자동 추정 ──
export function estimateHeaderRow(rows: ExcelRow[], maxScan: number = 5): number {
  let bestRow = 0;
  let bestScore = 0;

  const scanLimit = Math.min(rows.length, maxScan);
  for (let i = 0; i < scanLimit; i++) {
    let score = 0;
    for (const cell of rows[i].cells) {
      if (cell == null) continue;
      const text = String(cell).toLowerCase().trim();
      if (text.length === 0) continue;
      // 숫자만이면 data row일 확률 높음
      if (/^\d+(\.\d+)?$/.test(text)) continue;
      // 키워드 매칭
      for (const [, keywords] of Object.entries(COLUMN_KEYWORDS)) {
        if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
          score += 10;
        }
      }
      // 짧은 텍스트(라벨) 가산점
      if (text.length < 20) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

// ── 컬럼 자동 매핑 ──
export function autoMapColumns(headerCells: (string | number | null)[]): ColumnMapping[] {
  return headerCells.map((cell, index) => {
    const text = String(cell ?? "").toLowerCase().trim();
    let matchedRole: ColumnRole = "skip";
    let matchedConfidence: "auto" | "manual" = "manual";

    for (const [role, keywords] of Object.entries(COLUMN_KEYWORDS) as [ColumnRole, string[]][]) {
      if (role === "skip") continue;
      if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
        matchedRole = role;
        matchedConfidence = "auto";
        break;
      }
    }

    return {
      columnIndex: index,
      headerText: String(cell ?? ""),
      role: matchedRole,
      confidence: matchedConfidence,
    };
  });
}

// ── 셀 값 추출 헬퍼 ──
function getCellByRole(row: ExcelRow, mappings: ColumnMapping[], role: ColumnRole): string | null {
  const mapping = mappings.find((m) => m.role === role);
  if (!mapping) return null;
  const val = row.cells[mapping.columnIndex];
  if (val == null) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

function getNumericCellByRole(row: ExcelRow, mappings: ColumnMapping[], role: ColumnRole): number | null {
  const val = getCellByRole(row, mappings, role);
  if (val == null) return null;
  const num = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? null : num;
}

// ── rawInput 생성 ──
function buildRawInput(row: ExcelRow, mappings: ColumnMapping[]): string {
  const parts: string[] = [];
  const name = getCellByRole(row, mappings, "item_name");
  const mfr = getCellByRole(row, mappings, "manufacturer");
  const spec = getCellByRole(row, mappings, "spec");
  const qty = getCellByRole(row, mappings, "quantity");
  const unit = getCellByRole(row, mappings, "unit");

  if (name) parts.push(name);
  if (mfr) parts.push(mfr);
  if (spec) parts.push(spec);
  if (qty) parts.push(unit ? `${qty} ${unit}` : `${qty}개`);

  return parts.join(" / ") || row.cells.filter(Boolean).join(" · ");
}

// ── originalRow 매핑 ──
function buildOriginalRow(row: ExcelRow, mappings: ColumnMapping[]): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const m of mappings) {
    if (m.role !== "skip") {
      result[m.headerText] = row.cells[m.columnIndex] ?? null;
    }
  }
  return result;
}

function buildMappedColumns(row: ExcelRow, mappings: ColumnMapping[]): Record<ColumnRole, string | null> {
  const result: Partial<Record<ColumnRole, string | null>> = {};
  for (const m of mappings) {
    if (m.role !== "skip") {
      result[m.role] = getCellByRole(row, mappings, m.role);
    }
  }
  return result as Record<ColumnRole, string | null>;
}

// ── reviewReason 코드 ──
type ExcelReviewReasonCode =
  | "name_missing"
  | "manufacturer_missing"
  | "catalog_missing"
  | "spec_unclear"
  | "quantity_missing"
  | "unit_missing"
  | "multiple_candidates"
  | "spec_collision"
  | "brand_ambiguous"
  | "packaging_unclear"
  | "spec_mismatch"
  | "no_match"
  | "row_empty";

// ── status mapping ──
function mapExcelStatus(
  parsedItemName: string | null,
  reasons: ExcelReviewReasonCode[],
  candidateCount: number
): ReviewStatus {
  // 1순위: match_failed
  if (!parsedItemName || candidateCount === 0) {
    return "match_failed";
  }
  // 2순위: compare_needed
  if (candidateCount > 1) {
    return "compare_needed";
  }
  // 3순위: review_needed
  if (reasons.length > 0) {
    return "needs_review";
  }
  // 4순위: ready
  return "confirmed";
}

// ── confidence mapping ──
function mapExcelConfidence(
  parsedItemName: string | null,
  manufacturer: string | null,
  catalogNumber: string | null,
  spec: string | null,
  quantity: number | null,
  unit: string | null,
  status: ReviewStatus,
  reasons: ExcelReviewReasonCode[]
): ConfidenceLevel {
  if (status === "match_failed") return "low";

  const has = [!!manufacturer, !!catalogNumber, !!spec, quantity != null, !!unit];
  const presentCount = has.filter(Boolean).length;

  if (presentCount >= 4 && reasons.length === 0) return "high";
  if (presentCount <= 1) return "low";
  return "medium";
}

// ── 단일 엑셀 행 → ReviewQueueItem 변환 ──
export function mapExcelRowToQueueItem(
  context: ExcelParseContext,
  row: ExcelRow,
  matchCandidates: MatchCandidate[] = []
): ReviewQueueItem {
  const { fileName, sheetName, columnMappings } = context;

  const parsedItemName = getCellByRole(row, columnMappings, "item_name");
  const manufacturer = getCellByRole(row, columnMappings, "manufacturer");
  const catalogNumber = getCellByRole(row, columnMappings, "catalog_number");
  const spec = getCellByRole(row, columnMappings, "spec");
  const quantity = getNumericCellByRole(row, columnMappings, "quantity");
  const unit = getCellByRole(row, columnMappings, "unit");

  // reviewReason 수집
  const reasons: ExcelReviewReasonCode[] = [];
  if (!parsedItemName) reasons.push("name_missing");
  if (!manufacturer) reasons.push("manufacturer_missing");
  if (!catalogNumber) reasons.push("catalog_missing");
  if (!spec) reasons.push("spec_unclear");
  if (quantity == null) reasons.push("quantity_missing");
  if (!unit) reasons.push("unit_missing");

  // 행이 거의 비어있으면 row_empty
  const nonEmptyCells = row.cells.filter((c) => c != null && String(c).trim().length > 0).length;
  if (nonEmptyCells <= 1 && !parsedItemName) {
    reasons.push("row_empty");
  }

  // 후보가 여러 개면 reason 추가
  if (matchCandidates.length > 1) {
    reasons.push("multiple_candidates");
  }

  const candidateCount = matchCandidates.length;
  const status = mapExcelStatus(parsedItemName, reasons, candidateCount);
  const confidence = mapExcelConfidence(
    parsedItemName, manufacturer, catalogNumber, spec, quantity, unit, status, reasons
  );
  const needsReview = status !== "confirmed";

  // confirmed + 후보 1개이면 자동 선택
  const selectedProduct =
    status === "confirmed" && matchCandidates.length === 1 ? matchCandidates[0] : null;

  return {
    id: generateExcelQueueId(fileName, sheetName, row.rowIndex),
    sourceType: "excel",
    rawInput: buildRawInput(row, columnMappings),
    parsedItemName: parsedItemName ?? "",
    manufacturer,
    catalogNumber,
    spec,
    quantity,
    unit,
    confidence,
    status,
    matchCandidates,
    selectedProduct,
    needsReview,
    reviewReason: reasons.length > 0 ? [...new Set(reasons)].join(", ") : null,
    addedAt: new Date().toISOString(),
  };
}

// ── 엑셀 전체 행 배열 → ReviewQueueItem 배열 변환 ──
export function mapExcelRowsToQueueItems(
  context: ExcelParseContext,
  rows: ExcelRow[],
  matchCandidatesByRow?: Map<number, MatchCandidate[]>
): ReviewQueueItem[] {
  return rows
    .filter((row) => {
      // 완전히 빈 행 제외
      const nonEmpty = row.cells.filter((c) => c != null && String(c).trim().length > 0).length;
      return nonEmpty > 0;
    })
    .map((row) => {
      const candidates = matchCandidatesByRow?.get(row.rowIndex) ?? [];
      return mapExcelRowToQueueItem(context, row, candidates);
    });
}

// ── reviewReason 한글 라벨 매핑 ──
export const EXCEL_REVIEW_REASON_LABELS: Record<ExcelReviewReasonCode, string> = {
  name_missing: "품목명 확인 필요",
  manufacturer_missing: "제조사 확인 필요",
  catalog_missing: "카탈로그 번호 확인 필요",
  spec_unclear: "규격 확인 필요",
  quantity_missing: "수량 확인 필요",
  unit_missing: "단위 확인 필요",
  multiple_candidates: "후보 비교 필요",
  spec_collision: "규격이 유사한 후보가 여러 개 있습니다",
  brand_ambiguous: "제조사 구분이 필요합니다",
  packaging_unclear: "포장 단위 확인 필요",
  spec_mismatch: "원문 규격과 후보 규격이 다를 수 있습니다",
  no_match: "일치하는 후보를 찾지 못했습니다",
  row_empty: "유효한 입력 행이 아닙니다",
};
