/**
 * Excel Data Sanitization Utilities
 * 실무 엑셀의 더러운 데이터를 깨끗하게 정제하는 "정수기" 역할
 */

/**
 * 수량 필드 정제
 * "3개", "3box", "3 ea" → 3
 * "10개 (2박스)" → 10
 */
export function sanitizeQuantity(value: any): number | undefined {
  if (typeof value === "number") return Math.floor(value);
  if (!value) return undefined;

  const str = String(value).trim();
  if (!str) return undefined;

  // 숫자만 추출 (첫 번째 숫자 그룹)
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const num = parseFloat(match[1]);
  return isNaN(num) ? undefined : Math.floor(num);
}

/**
 * 날짜 필드 정제
 * - Excel serial number (44562 같은 숫자) → Date
 * - "2024-01-15", "2024/01/15" → Date
 * - 빈 값 → undefined
 */
export function sanitizeDate(value: any): Date | undefined {
  if (!value) return undefined;

  // 이미 Date 객체인 경우
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }

  // Excel serial number (숫자로 표현된 날짜)
  if (typeof value === "number") {
    // Excel의 1900-01-01 기준 serial number
    // 25569 = Unix epoch (1970-01-01)와 Excel epoch 차이 (일 단위)
    const excelEpoch = new Date(1899, 11, 30); // Excel의 기준일
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? undefined : date;
  }

  // 문자열 날짜 파싱
  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return undefined;

    // ISO 형식 시도
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // 한국식 날짜 형식 시도 (YYYY.MM.DD, YYYY/MM/DD, YYYY-MM-DD)
    const patterns = [
      /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/,
      /^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/, // YY.MM.DD
    ];

    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        let year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);

        // 2자리 연도를 4자리로 변환
        if (year < 100) {
          year += year > 50 ? 1900 : 2000;
        }

        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }

  return undefined;
}

/**
 * 텍스트 필드 정제
 * - 앞뒤 공백 제거
 * - 빈 문자열 → undefined
 * - 다중 공백 → 단일 공백
 */
export function sanitizeText(value: any): string | undefined {
  if (!value) return undefined;

  const str = String(value)
    .trim()
    .replace(/\s+/g, " "); // 다중 공백 → 단일 공백

  return str.length > 0 ? str : undefined;
}

/**
 * 가격/금액 필드 정제
 * "1,000원", "$1,000", "1000.50" → 1000
 * 소수점 반올림하여 정수 반환
 */
export function sanitizePrice(value: any): number | undefined {
  if (typeof value === "number") return Math.round(value);
  if (!value) return undefined;

  const str = String(value).trim();
  if (!str) return undefined;

  // 숫자와 소수점만 추출
  const cleaned = str.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);

  return isNaN(num) ? undefined : Math.round(num);
}

/**
 * Boolean 필드 정제
 * "yes", "Y", "true", "1", "o", "O" → true
 * "no", "N", "false", "0", "x", "X" → false
 */
export function sanitizeBoolean(value: any): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return undefined;

  const str = String(value).trim().toLowerCase();

  const trueValues = ["yes", "y", "true", "1", "o", "✓", "v"];
  const falseValues = ["no", "n", "false", "0", "x", "✗"];

  if (trueValues.includes(str)) return true;
  if (falseValues.includes(str)) return false;

  return undefined;
}

/**
 * 행 전체 유효성 검사
 * 필수 필드가 모두 있는지 확인
 */
export function validateRow(
  row: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!row[field] || (typeof row[field] === "string" && !row[field].trim())) {
      errors.push(`필수 필드 누락: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 에러 메시지 포맷팅
 */
export function formatImportError(
  row: number,
  field: string,
  value: any,
  reason: string
): string {
  return `행 ${row}, 필드 "${field}": ${reason} (입력값: "${value}")`;
}
