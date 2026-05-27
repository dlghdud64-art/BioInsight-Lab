/**
 * 시약 라벨 텍스트 파서
 *
 * OCR로 추출한 raw text에서 catalogNo, lotNo, expirationDate, brand, productName 등
 * 구조화된 데이터를 정규식 + 휴리스틱으로 추출합니다.
 *
 * 향후 OpenAI / Claude API 연동 시 이 모듈을 대체하면 됩니다.
 */

export interface LabelParseResult {
  catalogNo: string | null;
  lotNo: string | null;
  expirationDate: string | null;
  brand: string | null;
  productName: string | null;
  casNumber: string | null;
  quantity: string | null;
  rawText: string;
  confidence: "high" | "medium" | "low";
  matchedFields: number;
}

/** 주요 시약 제조사 패턴 */
const BRAND_PATTERNS: Array<{ regex: RegExp; brand: string }> = [
  { regex: /sigma[\s-]*aldrich/i, brand: "Sigma-Aldrich" },
  { regex: /merck\b/i, brand: "Merck" },
  { regex: /thermo\s*fisher/i, brand: "Thermo Fisher" },
  { regex: /invitrogen/i, brand: "Invitrogen" },
  { regex: /gibco/i, brand: "Gibco" },
  { regex: /corning/i, brand: "Corning" },
  { regex: /bd\s+biosciences/i, brand: "BD Biosciences" },
  { regex: /bio[\s-]*rad/i, brand: "Bio-Rad" },
  { regex: /roche/i, brand: "Roche" },
  { regex: /agilent/i, brand: "Agilent" },
  { regex: /promega/i, brand: "Promega" },
  { regex: /qiagen/i, brand: "QIAGEN" },
  { regex: /new\s*england\s*bio/i, brand: "New England Biolabs" },
  { regex: /neb\b/i, brand: "New England Biolabs" },
  { regex: /abcam/i, brand: "Abcam" },
  { regex: /cell\s*signaling/i, brand: "Cell Signaling Technology" },
  { regex: /santa\s*cruz/i, brand: "Santa Cruz" },
  { regex: /takara/i, brand: "Takara" },
  { regex: /dojindo/i, brand: "Dojindo" },
  { regex: /wako/i, brand: "FUJIFILM Wako" },
  { regex: /nacalai/i, brand: "Nacalai Tesque" },
  { regex: /대정화금/i, brand: "대정화금" },
  { regex: /덕산/i, brand: "덕산" },
  { regex: /삼전화학/i, brand: "삼전화학" },
  { regex: /junsei/i, brand: "Junsei" },
];

/** Catalog Number 추출 패턴 (제조사별 라벨 양식 대응) */
const CATALOG_PATTERNS: RegExp[] = [
  // "Cat. No.", "Cat No", "Cat.#", "Catalog No.", "Product No.", "Product #", "Item No."
  /(?:cat(?:alog)?\.?\s*(?:no|#|number)\.?\s*[:=]?\s*)([A-Z0-9][\w\-/.]{2,20})/i,
  // "REF" (주로 Thermo Fisher, BD 등)
  /(?:ref\.?\s*[:=]?\s*)([A-Z0-9][\w\-/.]{2,20})/i,
  // "P/N", "Part No."
  /(?:p\/n\.?\s*[:=]?\s*)([A-Z0-9][\w\-/.]{2,20})/i,
  // "Product No."
  /(?:product\s*(?:no|#|number)\.?\s*[:=]?\s*)([A-Z0-9][\w\-/.]{2,20})/i,
  // "Item No."
  /(?:item\s*(?:no|#|number)\.?\s*[:=]?\s*)([A-Z0-9][\w\-/.]{2,20})/i,
  // Sigma-Aldrich 스타일: 영문자 + 숫자 + 하이픈 + 용량 (예: S9888-500G, A2153-25G)
  /\b([A-Z]\d{3,6}-\d+[A-Z]{0,2})\b/,
];

/** Lot Number 추출 패턴 */
const LOT_PATTERNS: RegExp[] = [
  /(?:lot\.?\s*(?:no|#|number)?\.?\s*[:=]?\s*)([A-Z0-9][\w\-]{3,20})/i,
  /(?:batch\.?\s*(?:no|#|number)?\.?\s*[:=]?\s*)([A-Z0-9][\w\-]{3,20})/i,
  /(?:charge\.?\s*[:=]?\s*)([A-Z0-9][\w\-]{3,20})/i,
  // Sigma 스타일: SL + 영문자 + 숫자 (예: SLBC1234V, SLBX5678A)
  /\b(SL[A-Z]{2}\d{4,}[A-Z]?)\b/,
  // MKCD, MKCL 등
  /\b(MK[A-Z]{2}\d{4,})\b/,
];

/** 유통기한 추출 패턴 */
const EXPIRY_PATTERNS: RegExp[] = [
  // "Exp", "Expiry", "Expiration", "Use by", "Best before", "유효기한", "사용기한"
  /(?:exp(?:ir(?:y|ation))?\.?\s*(?:date)?\.?\s*[:=]?\s*)(\d{4}[\s./-]\d{1,2}(?:[\s./-]\d{1,2})?)/i,
  /(?:use\s*by\.?\s*[:=]?\s*)(\d{4}[\s./-]\d{1,2}(?:[\s./-]\d{1,2})?)/i,
  /(?:best\s*before\.?\s*[:=]?\s*)(\d{4}[\s./-]\d{1,2}(?:[\s./-]\d{1,2})?)/i,
  /(?:유효기한|사용기한|만료일)\.?\s*[:=]?\s*(\d{4}[\s./-]\d{1,2}(?:[\s./-]\d{1,2})?)/,
  // 역순: DD/MM/YYYY or MM/YYYY
  /(?:exp\.?\s*[:=]?\s*)(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{4})/i,
  // 년-월 만 (2025-12)
  /(?:exp\.?\s*[:=]?\s*)(\d{4}[\s./-]\d{1,2})\b/i,
];

/** CAS Number 패턴 */
const CAS_PATTERNS: RegExp[] = [
  /(?:cas\.?\s*(?:no|#|number|rn)?\.?\s*[:=]?\s*)(\d{2,7}-\d{2}-\d)/i,
  /\b(\d{2,7}-\d{2}-\d)\b/, // CAS 형식 직접 매칭
];

/** 용량/중량 패턴 */
const QUANTITY_PATTERNS: RegExp[] = [
  /\b(\d+(?:\.\d+)?\s*(?:mg|g|kg|ml|mL|L|µL|µg|ul|ug))\b/i,
  /\b(\d+(?:\.\d+)?\s*(?:units?|vials?|bottles?|tests?))\b/i,
];

function extractFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractBrand(text: string): string | null {
  for (const { regex, brand } of BRAND_PATTERNS) {
    if (regex.test(text)) return brand;
  }
  return null;
}

/** 날짜 문자열을 YYYY-MM-DD 형식으로 정규화 */
function normalizeDate(raw: string): string {
  // 구분자 통일
  const cleaned = raw.replace(/[\s.]/g, "-").replace(/\//g, "-");
  const parts = cleaned.split("-").filter(Boolean);

  if (parts.length === 2) {
    // YYYY-MM → YYYY-MM-01 (말일)
    const [y, m] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, "0")}-01`;
  }

  if (parts.length === 3) {
    const [a, b, c] = parts;
    // YYYY-MM-DD
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    // DD-MM-YYYY or MM-DD-YYYY
    if (c.length === 4) {
      const month = parseInt(a) > 12 ? b : a;
      const day = parseInt(a) > 12 ? a : b;
      return `${c}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return raw;
}

/**
 * 제품명 추출 (휴리스틱)
 * 브랜드명, catalog/lot/exp 라인을 제거한 뒤 가장 첫 의미 있는 줄을 제품명으로 추정
 */
function extractProductName(text: string, brand: string | null): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const skipPatterns = [
    /^(cat|lot|batch|ref|exp|use\s*by|best\s*before|cas|p\/n|item|product\s*no|유효|사용기한|만료)/i,
    /^(store|storage|keep|warning|caution|danger|flammable|toxic|corrosive|irritant)/i,
    /^\d+\s*(mg|g|kg|ml|mL|L)$/i,
    /^[A-Z0-9\-]{2,6}$/,  // 짧은 코드
  ];

  for (const line of lines) {
    // 브랜드 라인 스킵
    if (brand && line.toLowerCase().includes(brand.toLowerCase())) continue;
    // 패턴 스킵
    if (skipPatterns.some((p) => p.test(line))) continue;
    // 너무 짧거나 숫자로만 구성된 라인 스킵
    if (line.length < 3 || /^\d+$/.test(line)) continue;
    // 첫 의미 있는 줄
    return line.length > 80 ? line.slice(0, 80) : line;
  }
  return null;
}

/** 메인 파서 */
export function parseReagentLabel(rawText: string): LabelParseResult {
  const catalogNo = extractFirst(rawText, CATALOG_PATTERNS);
  const lotNo = extractFirst(rawText, LOT_PATTERNS);
  const rawExpiry = extractFirst(rawText, EXPIRY_PATTERNS);
  const expirationDate = rawExpiry ? normalizeDate(rawExpiry) : null;
  const brand = extractBrand(rawText);
  const casNumber = extractFirst(rawText, CAS_PATTERNS);
  const quantity = extractFirst(rawText, QUANTITY_PATTERNS);
  const productName = extractProductName(rawText, brand);

  const matchedFields = [catalogNo, lotNo, expirationDate, brand, productName, casNumber].filter(Boolean).length;
  const confidence: "high" | "medium" | "low" =
    matchedFields >= 4 ? "high" : matchedFields >= 2 ? "medium" : "low";

  return {
    catalogNo,
    lotNo,
    expirationDate,
    brand,
    productName,
    casNumber,
    quantity,
    rawText,
    confidence,
    matchedFields,
  };
}
