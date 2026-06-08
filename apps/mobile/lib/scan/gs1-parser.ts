/**
 * §gs1-datamatrix — GS1 element string 파서 (순수 / RN·DOM 무의존)
 *
 * 시약 라벨 2D datamatrix 는 GS1 표준으로 GTIN·Lot·유효기간을 결정적 인코딩한다.
 * 작은 기술인쇄 OCR(불안정)보다 신뢰도 높아 재고 등록 Lot/Expiry 의 1차 소스.
 *
 * 범위(시약 라벨 빈출 AI):
 *   01 GTIN(14, 고정) · 11 생산일(YYMMDD) · 15 best-before(YYMMDD) · 17 유효기간(YYMMDD)
 *   10 Lot/Batch(가변, FNC1) · 21 Serial(가변, FNC1)
 * 미지 AI 는 graceful skip(throw 0). GTIN→제품 매칭은 범위 밖(카탈로그 GTIN 필드 부재).
 *
 * 입력 양식 2종:
 *   - raw scan: FNC1 = GS(\x1d) 구분자. 고정길이 AI 는 길이로, 가변 AI 는 FNC1/끝까지.
 *   - 사람가독(HRI): "(01)08806... (17)261231 (10)ABC123" 괄호 양식.
 *
 * 순수 함수만(외부 import 0) → vitest 단위 검증 가능.
 */

export interface Gs1Parsed {
  /** GTIN-14 (표시용 — 제품 매칭 아님). */
  gtin: string | null;
  /** Lot/Batch (AI 10). */
  lotNo: string | null;
  /** 유효기간 (AI 17) → YYYY-MM-DD (DD=00 이면 YYYY-MM, day=null). */
  expirationDate: string | null;
  /** 생산일 (AI 11) → YYYY-MM-DD. */
  productionDate: string | null;
  /** Serial (AI 21). */
  serial: string | null;
  /** 인식된 AI 키→raw 값 전체(디버그·확장용). */
  elements: Record<string, string>;
  /** GS1 로 해석 가능했는가(최소 1개 AI 인식). */
  isGs1: boolean;
}

const FNC1 = "\x1d"; // GS (ASCII 29)

/** 고정 길이 AI (값 길이). */
const FIXED_LEN: Record<string, number> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};

/** YYMMDD → ISO. DD=00 → 일(day) 미상 → YYYY-MM. YY: 00–49=20YY, 50–99=19YY(GS1 규칙). */
function yymmddToIso(v: string): string | null {
  if (!/^\d{6}$/.test(v)) return null;
  const yy = parseInt(v.slice(0, 2), 10);
  const mm = v.slice(2, 4);
  const dd = v.slice(4, 6);
  const year = yy <= 49 ? 2000 + yy : 1900 + yy;
  if (mm < "01" || mm > "12") return null;
  if (dd === "00") return `${year}-${mm}`;
  if (dd < "01" || dd > "31") return null;
  return `${year}-${mm}-${dd}`;
}

/** 괄호 HRI 양식 → FNC1 정규화(가변 AI 뒤에 FNC1 삽입). */
function normalizeParenForm(input: string): string {
  // "(01)...(17)..." → AI별 분해 후 가변 AI는 FNC1 종료.
  const parts = input.match(/\((\d{2,4})\)([^(]*)/g);
  if (!parts) return input;
  let out = "";
  for (const part of parts) {
    const m = part.match(/\((\d{2,4})\)(.*)/);
    if (!m) continue;
    const ai = m[1];
    const val = m[2];
    out += ai + val;
    if (!(ai in FIXED_LEN)) out += FNC1; // 가변 AI 종료
  }
  return out;
}

export function parseGs1(rawInput: string | null | undefined): Gs1Parsed {
  const empty: Gs1Parsed = {
    gtin: null, lotNo: null, expirationDate: null,
    productionDate: null, serial: null, elements: {}, isGs1: false,
  };
  if (!rawInput || typeof rawInput !== "string") return empty;

  let s = rawInput;
  // GS1 datamatrix 는 보통 선두에 FNC1(심볼로지 식별자) — 제거.
  if (s.startsWith(FNC1)) s = s.slice(1);
  // 괄호 HRI 양식이면 정규화.
  if (s.includes("(")) s = normalizeParenForm(s);

  const elements: Record<string, string> = {};
  let i = 0;
  let guard = 0;
  while (i < s.length && guard++ < 64) {
    // AI 는 2~4자리. 고정표/알려진 가변(10/21/240..) 우선 2자리 매칭.
    const ai2 = s.slice(i, i + 2);
    let ai = ai2;
    let valStart = i + 2;

    if (ai in FIXED_LEN) {
      const len = FIXED_LEN[ai];
      const val = s.slice(valStart, valStart + len);
      elements[ai] = val;
      i = valStart + len;
      // 고정길이 뒤 FNC1 있으면 skip
      if (s[i] === FNC1) i++;
      continue;
    }
    // 가변 길이 AI (10 lot, 21 serial 등) — FNC1 또는 끝까지.
    if (ai === "10" || ai === "21" || ai === "22" || ai === "240" || ai === "241") {
      // 240/241 은 3자리 AI
      if (s.slice(i, i + 3) === "240" || s.slice(i, i + 3) === "241") {
        ai = s.slice(i, i + 3);
        valStart = i + 3;
      }
      const fnc = s.indexOf(FNC1, valStart);
      const end = fnc === -1 ? s.length : fnc;
      elements[ai] = s.slice(valStart, end);
      i = end === s.length ? end : end + 1; // FNC1 skip
      continue;
    }
    // 미지 AI — graceful 중단(부분 결과 보존).
    break;
  }

  const expirationDate = elements["17"] ? yymmddToIso(elements["17"]) : null;
  const productionDate = elements["11"] ? yymmddToIso(elements["11"]) : null;

  return {
    gtin: elements["01"] ?? null,
    lotNo: elements["10"] ?? null,
    expirationDate,
    productionDate,
    serial: elements["21"] ?? null,
    elements,
    isGs1: Object.keys(elements).length > 0,
  };
}
