/**
 * §receiving-extracted-shape (호영님 2026-09-05) — `InventoryRestock.extractedData` 의 계약.
 *
 * 왜 이 파일이 있는가 (2026-09-05 prod 실측):
 *   같은 컬럼에 **생산자마다 다른 스키마**가 들어간다.
 *     단품 경로   → `confirmedData` 통째 (brand·lotNumber·storageCondition·casNumber …)
 *     다품목 경로 → `line` 객체만       (productName·catalogNumber·quantity·unit·category)
 *   §receiving-scan-source-merge 의 C3(공급사명 = extractedData 에서 파생)가 틀린 이유가 이것이다.
 *   계획서 작성자가 "extractedData 에 brand 가 있다" 고 가정했고, **그 가정을 검증할 수단이 없었다.**
 *   실측: 스캔 3건의 키가 ["unit","category","quantity","productName","catalogNumber"] — brand 없음.
 *
 *   이건 [필드명 ≠ 내용] 의 재발이다. brand 만 채우면 증상은 사라지지만 구조는 남는다 —
 *   다음에 다른 필드가 같은 방식으로 비어 있을 때 또 파야 한다(호영님 지적).
 *
 * 그래서 두 가지를 함께 둔다 (lotSource·categorySource 와 같은 계열 —
 * 값만 두지 말고 **그 값이 어디서 왔는지**를 함께 둔다):
 *   ① `shape` — 읽는 쪽이 어느 스키마인지 **추측하지 않게** 한다
 *   ② 공통 보장 필드 — 두 경로가 **반드시** 채우는 집합. 없으면 null 로 명시한다
 *      (키 부재와 값 없음을 구분한다. 부재는 "이 경로엔 그 축이 없다" 로 오해된다)
 *
 * 🛑 원본 필드는 지우지 않는다. 공통 집합 위에 얹을 뿐이라 단품 경로의 추가 축
 *    (storageCondition·casNumber·packSize 등)은 감사 추적용으로 그대로 남는다.
 */

export const EXTRACTED_SHAPE = {
  /** 단품 확인 화면에서 온 `confirmedData`. */
  SINGLE: "SINGLE",
  /** 다품목 라인 테이블에서 온 `line` 1건. */
  MULTI: "MULTI",
} as const;

export type ExtractedShape = (typeof EXTRACTED_SHAPE)[keyof typeof EXTRACTED_SHAPE];

/**
 * 두 경로가 **공통으로 보장**하는 필드. 읽는 쪽은 이것만 무조건 기대할 수 있다.
 * 🛑 여기 없는 필드를 공통인 것처럼 읽지 말 것 — C3 가 정확히 그 실수였다.
 */
export interface ReceivingExtractedCommon {
  shape: ExtractedShape;
  productName: string | null;
  catalogNumber: string | null;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
}

/** 공통 보장 필드의 키 목록 — sentinel·소비자가 같은 목록을 본다. */
export const EXTRACTED_COMMON_KEYS = [
  "shape",
  "productName",
  "catalogNumber",
  "brand",
  "quantity",
  "unit",
  "lotNumber",
  "expirationDate",
] as const satisfies readonly (keyof ReceivingExtractedCommon)[];

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * 어느 경로의 payload 든 **같은 계약**으로 정규화한다.
 * 원본 키는 보존하고 그 위에 shape + 공통 집합을 덮는다.
 *
 * @param shape 어느 화면에서 왔는가 — 읽는 쪽의 추측을 없애는 축.
 * @param raw   그 경로가 실제로 보낸 payload(단품 confirmedData · 다품목 line).
 */
export function buildExtractedData(
  shape: ExtractedShape,
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> & ReceivingExtractedCommon {
  const src = raw ?? {};
  return {
    ...src,
    shape,
    productName: str(src.productName),
    catalogNumber: str(src.catalogNumber),
    brand: str(src.brand),
    quantity: num(src.quantity),
    unit: str(src.unit),
    lotNumber: str(src.lotNumber),
    // 단품은 expirationDate, 다품목도 같은 이름을 쓴다(라인 타입 정합).
    expirationDate: str(src.expirationDate),
  };
}

/**
 * 저장된 값에서 공급사명을 읽는다. 없으면 null —
 * **지어내지 않는다**(§receiving-scan-source-merge C3: 없으면 `공급사 미지정`).
 */
export function vendorNameFromExtracted(
  extracted: unknown,
): string | null {
  if (!extracted || typeof extracted !== "object") return null;
  return str((extracted as Record<string, unknown>).brand);
}
