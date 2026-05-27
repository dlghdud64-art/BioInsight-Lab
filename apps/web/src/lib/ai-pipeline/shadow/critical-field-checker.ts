/**
 * Critical Field Conflict Checker
 *
 * Auto-verify 판단에서 critical field conflict를 검사.
 * Critical fields: vendor, totalAmount, currency, documentDate,
 *                  classificationIndicator, purchaseIdentifier
 *
 * Conflict types:
 *  - VALUE_DISAGREEMENT: rules vs ai 값 불일치
 *  - MISSING_EXPECTED_FIELD: rules에 있는데 ai에 없음
 *  - NORMALIZATION_MISMATCH: 정규화 후 의미적 차이
 *  - CONFLICTING_CLASSIFICATION: 분류 신호 충돌
 *  - AMBIGUOUS_HIGH_CONFIDENCE: confidence 높지만 모호한 추출
 */

import type { CriticalField, CriticalConflictType, CriticalFieldConflict } from "./types";

export interface FieldPair {
  field: CriticalField;
  rulesValue: string | null;
  aiValue: string | null;
}

/**
 * Rules vs AI 결과의 critical field conflict 검사.
 * 각 필드 페어에 대해 conflict 여부와 유형을 판정.
 */
export function checkCriticalFieldConflicts(
  fields: FieldPair[],
  confidence: number | null,
): CriticalFieldConflict[] {
  const conflicts: CriticalFieldConflict[] = [];

  for (const fp of fields) {
    const conflict = evaluateFieldPair(fp, confidence);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

function evaluateFieldPair(
  fp: FieldPair,
  confidence: number | null,
): CriticalFieldConflict | null {
  const { field, rulesValue, aiValue } = fp;

  // Missing expected field: rules에 있는데 ai에 없음
  if (rulesValue && !aiValue) {
    return {
      field,
      conflictType: "MISSING_EXPECTED_FIELD",
      rulesValue,
      aiValue,
      severity: "HIGH",
    };
  }

  // 둘 다 없으면 conflict 아님
  if (!rulesValue && !aiValue) return null;

  // 둘 다 있으면 비교
  if (rulesValue && aiValue) {
    // 정확히 같으면 OK
    if (rulesValue === aiValue) return null;

    // 정규화 비교 (소문자, 공백 제거, 숫자 정규화)
    const normRules = normalizeValue(field, rulesValue);
    const normAi = normalizeValue(field, aiValue);

    if (normRules === normAi) {
      // 정규화 후 같으면 → 위험도 낮은 차이
      return null;
    }

    // 금액 필드: 수치적 차이 검사
    if (field === "totalAmount") {
      const rulesNum = parseFloat(rulesValue.replace(/[^0-9.,-]/g, ""));
      const aiNum = parseFloat(aiValue.replace(/[^0-9.,-]/g, ""));
      if (!isNaN(rulesNum) && !isNaN(aiNum)) {
        const diff = Math.abs(rulesNum - aiNum);
        const pct = rulesNum > 0 ? diff / rulesNum : 0;
        if (pct > 0.01) {
          return {
            field,
            conflictType: "NORMALIZATION_MISMATCH",
            rulesValue,
            aiValue,
            severity: pct > 0.05 ? "HIGH" : "MEDIUM",
          };
        }
        return null; // 1% 이내 차이는 허용
      }
    }

    // Classification indicator 충돌
    if (field === "classificationIndicator") {
      return {
        field,
        conflictType: "CONFLICTING_CLASSIFICATION",
        rulesValue,
        aiValue,
        severity: "HIGH",
      };
    }

    // Confidence 높은데 값 불일치 → ambiguous
    if (confidence !== null && confidence >= 0.95) {
      return {
        field,
        conflictType: "AMBIGUOUS_HIGH_CONFIDENCE",
        rulesValue,
        aiValue,
        severity: "HIGH",
      };
    }

    // 일반 값 불일치
    return {
      field,
      conflictType: "VALUE_DISAGREEMENT",
      rulesValue,
      aiValue,
      severity: "MEDIUM",
    };
  }

  return null;
}

function normalizeValue(field: CriticalField, value: string): string {
  let v = value.trim().toLowerCase();

  if (field === "totalAmount" || field === "currency") {
    v = v.replace(/\s+/g, "").replace(/,/g, "");
  }

  if (field === "documentDate") {
    // 날짜 정규화: 다양한 포맷 → YYYY-MM-DD
    const dateMatch = v.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (dateMatch) {
      v = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }
  }

  if (field === "vendor") {
    // 벤더명 정규화: 공백, 특수문자 제거
    v = v.replace(/[^a-z0-9가-힣]/g, "");
  }

  return v;
}

/**
 * Critical field conflict가 있는지 간단 판정 (boolean).
 * Runtime Gateway에서 빠른 체크용.
 */
export function hasCriticalConflict(conflicts: CriticalFieldConflict[]): boolean {
  return conflicts.some((c) => c.severity === "HIGH");
}

/**
 * Conflict summary 문자열 생성 (로그용).
 */
export function summarizeConflicts(conflicts: CriticalFieldConflict[]): string {
  if (conflicts.length === 0) return "none";
  return conflicts
    .map((c) => `${c.field}:${c.conflictType}(${c.severity})`)
    .join(", ");
}
