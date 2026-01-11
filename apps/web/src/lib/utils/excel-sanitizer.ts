/**
 * Excel 데이터 정제 및 검증 유틸리티
 */

/**
 * 텍스트를 정제합니다 (공백 제거, 특수문자 처리)
 */
export function sanitizeText(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

/**
 * 수량을 정제하고 검증합니다
 */
export function sanitizeQuantity(value: any): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // 숫자로 변환 시도
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : Number(value);
  
  if (isNaN(num) || num < 0) {
    return null;
  }
  
  return Math.floor(num); // 정수로 변환
}

/**
 * 날짜를 정제하고 Date 객체로 변환합니다
 */
export function sanitizeDate(value: any): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // Excel 날짜 번호인 경우 (1900년 1월 1일 기준)
  if (typeof value === "number") {
    // Excel의 날짜 번호를 Date로 변환
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch: 1900-01-01 (하지만 1899-12-30이 실제 시작점)
    const days = Math.floor(value);
    const date = new Date(excelEpoch);
    date.setDate(date.getDate() + days);
    return date;
  }
  
  // 문자열인 경우
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    // ISO 형식 시도
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
    
    // 한국 날짜 형식 시도 (YYYY-MM-DD, YYYY/MM/DD 등)
    const dateStr = trimmed.replace(/[\/\.]/g, "-");
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

/**
 * 행 데이터를 검증합니다
 */
export function validateRow(row: any, requiredFields?: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // requiredFields가 배열인 경우 (기존 호출 방식)
  if (Array.isArray(requiredFields)) {
    requiredFields.forEach((field) => {
      if (!row[field]) {
        errors.push(`${field}가 필요합니다`);
      }
    });
  } else {
    // rowIndex가 숫자인 경우 (새로운 호출 방식)
    const rowIndex = typeof requiredFields === "number" ? requiredFields : 0;
    
    // 제품명 필수
    const productName = sanitizeText(row.productName || row["제품명"] || row["Product Name"]);
    if (!productName) {
      errors.push(`행 ${rowIndex + 1}: 제품명이 필요합니다`);
    }
    
    // 수량 검증
    const quantity = sanitizeQuantity(row.quantity || row["수량"] || row["Quantity"]);
    if (quantity === null || quantity <= 0) {
      errors.push(`행 ${rowIndex + 1}: 유효한 수량이 필요합니다`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

