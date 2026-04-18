/**
 * Inventory Import Staging Engine
 * ─────────────────────────────────
 * AI-assisted file import staging: parse → AI mapping → confidence scoring → operator review → canonical write
 *
 * 핵심 원칙:
 * - AI는 parsing/mapping assistant — canonical inventory write는 operator review 후에만 실행
 * - preview / apply 완전 분리
 * - confidence score 기반 분류
 * - low-confidence row는 별도 review queue
 * - unknown item direct create 금지 (승인 필요)
 * - import audit log 필수
 */

// ── Import Mode ──
export type ImportMode = "append" | "merge" | "overwrite";

// ── Staging Status ──
export type ImportStagingStatus =
  | "file_uploaded"
  | "ai_parsing"
  | "ai_mapping_complete"
  | "operator_reviewing"
  | "operator_approved"
  | "applying"
  | "applied"
  | "cancelled";

export type ImportStagingSubstatus =
  | "awaiting_file"
  | "parsing_in_progress"
  | "mapping_in_progress"
  | "review_ready"
  | "review_in_progress"
  | "low_confidence_pending"
  | "conflicts_pending"
  | "ready_to_apply"
  | "apply_in_progress"
  | "apply_complete"
  | "apply_partial";

// ── Confidence Level ──
export type ConfidenceLevel = "high" | "medium" | "low" | "unmapped";

export function getConfidenceThreshold(level: ConfidenceLevel): number {
  switch (level) {
    case "high": return 0.85;
    case "medium": return 0.6;
    case "low": return 0.3;
    case "unmapped": return 0;
  }
}

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.3) return "low";
  return "unmapped";
}

// ── Column Mapping ──
export interface ColumnMappingResult {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  aiReasoning: string;
  operatorOverride: string | null;
}

// ── Parsed Row ──
export interface ParsedImportRow {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: {
    productName: string | null;
    catalogNumber: string | null;
    brand: string | null;
    lotNumber: string | null;
    quantity: number | null;
    unit: string | null;
    expiryDate: string | null;
    location: string | null;
    storageCondition: string | null;
    safetyStock: number | null;
    minOrderQty: number | null;
    notes: string | null;
  };
  rowConfidence: number;
  rowConfidenceLevel: ConfidenceLevel;
  issues: RowIssue[];
  operatorDecision: RowDecision;
  matchedInventoryId: string | null;
  matchedProductId: string | null;
  isNewItem: boolean;
  isDuplicate: boolean;
  duplicateOfRowIndex: number | null;
}

export type RowDecision = "pending" | "approved" | "rejected" | "corrected";

export interface RowIssue {
  type: "missing_required" | "invalid_format" | "duplicate_detected" | "conflict_with_existing"
    | "low_confidence_mapping" | "unknown_unit" | "unknown_location" | "expired_item"
    | "abnormal_quantity" | "catalog_mismatch" | "lot_conflict";
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
  autoResolvable: boolean;
}

// ── Staging State ──
export interface ImportStagingState {
  importStagingStatus: ImportStagingStatus;
  substatus: ImportStagingSubstatus;
  importMode: ImportMode;
  fileName: string;
  fileSize: number;
  fileId: string;
  uploadedAt: string;
  totalRowCount: number;
  parsedRowCount: number;
  columnMappings: ColumnMappingResult[];
  rows: ParsedImportRow[];
  // Confidence breakdown
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  unmappedCount: number;
  // Issue summary
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
  newItemCount: number;
  // Operator decisions
  approvedCount: number;
  rejectedCount: number;
  correctedCount: number;
  pendingDecisionCount: number;
  // Apply results
  appliedCount: number;
  failedCount: number;
  // Audit
  importAuditId: string | null;
}

// ── Create Initial State ──
export function createInitialImportStagingState(file: { name: string; size: number; id: string }): ImportStagingState {
  return {
    importStagingStatus: "file_uploaded",
    substatus: "awaiting_file",
    importMode: "merge",
    fileName: file.name,
    fileSize: file.size,
    fileId: file.id,
    uploadedAt: new Date().toISOString(),
    totalRowCount: 0,
    parsedRowCount: 0,
    columnMappings: [],
    rows: [],
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    unmappedCount: 0,
    errorCount: 0,
    warningCount: 0,
    duplicateCount: 0,
    newItemCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    correctedCount: 0,
    pendingDecisionCount: 0,
    appliedCount: 0,
    failedCount: 0,
    importAuditId: null,
  };
}

// ── Standard Target Fields ──
export const IMPORT_TARGET_FIELDS = [
  { key: "productName", label: "제품명", required: true },
  { key: "catalogNumber", label: "카탈로그 번호", required: false },
  { key: "brand", label: "제조사/브랜드", required: false },
  { key: "lotNumber", label: "Lot 번호", required: false },
  { key: "quantity", label: "수량", required: true },
  { key: "unit", label: "단위", required: false },
  { key: "expiryDate", label: "유효기한", required: false },
  { key: "location", label: "보관 위치", required: false },
  { key: "storageCondition", label: "보관 조건", required: false },
  { key: "safetyStock", label: "안전 재고", required: false },
  { key: "minOrderQty", label: "최소 주문 수량", required: false },
  { key: "notes", label: "비고", required: false },
] as const;

// ── AI Column Mapping Simulation ──
// 실제 구현 시 외부 AI API를 호출하지만, schema-aware preprocessing 후 semantic mapping만 요청
export function simulateAIColumnMapping(sourceColumns: string[]): ColumnMappingResult[] {
  const knownPatterns: Record<string, { field: string; confidence: number; reasoning: string }[]> = {
    "시약명|제품명|품명|품목명|item name|product name|name": [{ field: "productName", confidence: 0.95, reasoning: "제품명 컬럼 패턴 매칭" }],
    "카탈로그|catalog|cat no|cat#|제품번호": [{ field: "catalogNumber", confidence: 0.9, reasoning: "카탈로그번호 패턴 매칭" }],
    "제조사|브랜드|brand|manufacturer|maker": [{ field: "brand", confidence: 0.88, reasoning: "제조사/브랜드 패턴 매칭" }],
    "lot|lot no|로트|배치|batch": [{ field: "lotNumber", confidence: 0.92, reasoning: "Lot 번호 패턴 매칭" }],
    "수량|재고|qty|quantity|stock|현재수량|재고수량": [{ field: "quantity", confidence: 0.9, reasoning: "수량 패턴 매칭" }],
    "단위|unit": [{ field: "unit", confidence: 0.93, reasoning: "단위 패턴 매칭" }],
    "유효기한|유통기한|expiry|만료|exp date|사용기한": [{ field: "expiryDate", confidence: 0.91, reasoning: "유효기한 패턴 매칭" }],
    "위치|보관위치|location|storage|보관장소": [{ field: "location", confidence: 0.87, reasoning: "보관 위치 패턴 매칭" }],
    "보관조건|storage condition|온도|저장조건": [{ field: "storageCondition", confidence: 0.82, reasoning: "보관 조건 패턴 매칭" }],
    "안전재고|safety stock|최소재고": [{ field: "safetyStock", confidence: 0.85, reasoning: "안전 재고 패턴 매칭" }],
    "최소주문|min order|moq": [{ field: "minOrderQty", confidence: 0.84, reasoning: "최소 주문 수량 패턴 매칭" }],
    "비고|메모|note|notes|remarks|참고": [{ field: "notes", confidence: 0.88, reasoning: "비고 패턴 매칭" }],
  };

  return sourceColumns.map(col => {
    const normalized = col.toLowerCase().replace(/[_\s\-#.]/g, "");
    let bestMatch: { field: string; confidence: number; reasoning: string } | null = null;

    for (const [pattern, matches] of Object.entries(knownPatterns)) {
      const keywords = pattern.split("|");
      for (const kw of keywords) {
        const kwNorm = kw.toLowerCase().replace(/[_\s\-#.]/g, "");
        if (normalized.includes(kwNorm) || kwNorm.includes(normalized)) {
          const match = matches[0];
          if (!bestMatch || match.confidence > bestMatch.confidence) {
            bestMatch = match;
          }
        }
      }
    }

    if (bestMatch) {
      return {
        sourceColumn: col,
        targetField: bestMatch.field,
        confidence: bestMatch.confidence,
        confidenceLevel: classifyConfidence(bestMatch.confidence),
        aiReasoning: bestMatch.reasoning,
        operatorOverride: null,
      };
    }

    return {
      sourceColumn: col,
      targetField: "",
      confidence: 0,
      confidenceLevel: "unmapped" as ConfidenceLevel,
      aiReasoning: "매칭되는 표준 필드 없음",
      operatorOverride: null,
    };
  });
}

// ── Row Validation ──
export function validateImportRow(row: ParsedImportRow): RowIssue[] {
  const issues: RowIssue[] = [];
  const d = row.mappedData;

  if (!d.productName || d.productName.trim() === "") {
    issues.push({ type: "missing_required", field: "productName", message: "제품명 누락", severity: "error", autoResolvable: false });
  }
  if (d.quantity === null || d.quantity === undefined) {
    issues.push({ type: "missing_required", field: "quantity", message: "수량 누락", severity: "error", autoResolvable: false });
  }
  if (d.quantity !== null && d.quantity < 0) {
    issues.push({ type: "abnormal_quantity", field: "quantity", message: "음수 수량", severity: "error", autoResolvable: false });
  }
  if (d.quantity !== null && d.quantity > 100000) {
    issues.push({ type: "abnormal_quantity", field: "quantity", message: "비정상 대량 수량 (>100,000)", severity: "warning", autoResolvable: false });
  }
  if (d.expiryDate) {
    const expDate = new Date(d.expiryDate);
    if (isNaN(expDate.getTime())) {
      issues.push({ type: "invalid_format", field: "expiryDate", message: "유효기한 형식 오류", severity: "error", autoResolvable: false });
    } else if (expDate.getTime() < Date.now()) {
      issues.push({ type: "expired_item", field: "expiryDate", message: "이미 만료된 항목", severity: "warning", autoResolvable: false });
    }
  }

  return issues;
}

// ── Duplicate Detection ──
export function detectDuplicates(rows: ParsedImportRow[]): ParsedImportRow[] {
  const seen = new Map<string, number>();

  return rows.map(row => {
    const key = [
      row.mappedData.productName?.toLowerCase().trim(),
      row.mappedData.catalogNumber?.toLowerCase().trim(),
      row.mappedData.lotNumber?.toLowerCase().trim(),
    ].filter(Boolean).join("|");

    if (key && seen.has(key)) {
      return {
        ...row,
        isDuplicate: true,
        duplicateOfRowIndex: seen.get(key)!,
        issues: [
          ...row.issues,
          {
            type: "duplicate_detected" as const,
            field: "productName",
            message: `행 ${seen.get(key)! + 1}과 중복 의심`,
            severity: "warning" as const,
            autoResolvable: false,
          },
        ],
      };
    }

    if (key) seen.set(key, row.rowIndex);
    return row;
  });
}

// ── Confidence Summary ──
export function computeConfidenceSummary(rows: ParsedImportRow[]) {
  let high = 0, medium = 0, low = 0, unmapped = 0;
  for (const row of rows) {
    switch (row.rowConfidenceLevel) {
      case "high": high++; break;
      case "medium": medium++; break;
      case "low": low++; break;
      case "unmapped": unmapped++; break;
    }
  }
  return { high, medium, low, unmapped };
}

// ── Issue Summary ──
export function computeIssueSummary(rows: ParsedImportRow[]) {
  let errors = 0, warnings = 0, duplicates = 0, newItems = 0;
  for (const row of rows) {
    if (row.issues.some(i => i.severity === "error")) errors++;
    if (row.issues.some(i => i.severity === "warning")) warnings++;
    if (row.isDuplicate) duplicates++;
    if (row.isNewItem) newItems++;
  }
  return { errors, warnings, duplicates, newItems };
}

// ── Staging Validation ──
export interface ImportStagingValidation {
  canApply: boolean;
  blockingIssues: string[];
  warnings: string[];
  recommendedNextAction: string;
}

export function validateImportStagingBeforeApply(state: ImportStagingState): ImportStagingValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (state.pendingDecisionCount > 0) {
    blocking.push(`${state.pendingDecisionCount}개 행 검토 미완료`);
  }
  if (state.errorCount > 0) {
    const unresolvedErrors = state.rows.filter(
      r => r.issues.some(i => i.severity === "error") && r.operatorDecision !== "rejected" && r.operatorDecision !== "corrected"
    );
    if (unresolvedErrors.length > 0) {
      blocking.push(`${unresolvedErrors.length}개 행 오류 미해결`);
    }
  }
  if (state.approvedCount === 0 && state.correctedCount === 0) {
    blocking.push("승인된 행 없음");
  }

  if (state.newItemCount > 0) {
    const unapprovedNew = state.rows.filter(r => r.isNewItem && r.operatorDecision === "pending");
    if (unapprovedNew.length > 0) {
      blocking.push(`${unapprovedNew.length}개 신규 품목 승인 필요`);
    }
  }

  if (state.duplicateCount > 0) {
    warnings.push(`${state.duplicateCount}개 중복 의심 행`);
  }
  if (state.lowConfidenceCount > 0) {
    warnings.push(`${state.lowConfidenceCount}개 저신뢰도 행`);
  }

  const canApply = blocking.length === 0;
  let recommended = "";
  if (!canApply) {
    recommended = blocking[0];
  } else if (warnings.length > 0) {
    recommended = `경고 ${warnings.length}건 확인 후 적용 가능`;
  } else {
    recommended = "모든 검토 완료 — 적용 가능";
  }

  return { canApply, blockingIssues: blocking, warnings, recommendedNextAction: recommended };
}

// ── Build Apply Payload ──
export interface ImportApplyPayload {
  importMode: ImportMode;
  rows: Array<{
    rowIndex: number;
    decision: RowDecision;
    data: ParsedImportRow["mappedData"];
    matchedInventoryId: string | null;
    isNewItem: boolean;
  }>;
  totalApplyCount: number;
  newItemCount: number;
  mergeCount: number;
}

export function buildImportApplyPayload(state: ImportStagingState): ImportApplyPayload {
  const applicableRows = state.rows.filter(
    r => r.operatorDecision === "approved" || r.operatorDecision === "corrected"
  );

  return {
    importMode: state.importMode,
    rows: applicableRows.map(r => ({
      rowIndex: r.rowIndex,
      decision: r.operatorDecision,
      data: r.mappedData,
      matchedInventoryId: r.matchedInventoryId,
      isNewItem: r.isNewItem,
    })),
    totalApplyCount: applicableRows.length,
    newItemCount: applicableRows.filter(r => r.isNewItem).length,
    mergeCount: applicableRows.filter(r => !r.isNewItem && r.matchedInventoryId).length,
  };
}

// ── Audit Log Entry ──
export interface ImportAuditEntry {
  id: string;
  timestamp: string;
  fileName: string;
  totalRows: number;
  appliedRows: number;
  rejectedRows: number;
  newItemsCreated: number;
  mergedItems: number;
  importMode: ImportMode;
  operatorId: string;
}

export function buildImportAuditEntry(state: ImportStagingState, operatorId: string): ImportAuditEntry {
  return {
    id: `import_${Date.now()}`,
    timestamp: new Date().toISOString(),
    fileName: state.fileName,
    totalRows: state.totalRowCount,
    appliedRows: state.appliedCount || (state.approvedCount + state.correctedCount),
    rejectedRows: state.rejectedCount,
    newItemsCreated: state.rows.filter(r => r.isNewItem && (r.operatorDecision === "approved" || r.operatorDecision === "corrected")).length,
    mergedItems: state.rows.filter(r => !r.isNewItem && r.matchedInventoryId && (r.operatorDecision === "approved" || r.operatorDecision === "corrected")).length,
    importMode: state.importMode,
    operatorId,
  };
}
