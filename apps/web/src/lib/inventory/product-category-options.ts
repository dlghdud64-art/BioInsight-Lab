/**
 * §scan-registration-category (호영님 2026-09-04) — 품목 분류 단일 소스.
 *
 * 왜 이 파일이 있는가:
 *   smart-receiving 이 `"OTHER" as ProductCategory` 로 기본값을 만들고 있었다.
 *   `as` 캐스트가 타입 검사를 통째로 우회해서, prod enum 에 없는 값이 그대로 통과했고
 *   신규 품목 스캔 입고가 100% 실패해 왔다(Product 314건 중 OTHER 0건 = 성공 이력 0).
 *   화면·API·게이트가 **서로 다른 목록**을 들고 있으면 같은 사고가 반복된다.
 *
 * 규칙(호영님 승격 2026-09-04):
 *   enum 값을 담는 상수는 문자열 리터럴을 `as` 로 캐스트해 만들지 않는다.
 *   여기 상수들은 전부 `ProductCategory` 로 **선언만** 하고 캐스트하지 않는다 —
 *   그래야 enum 에서 값이 빠지는 순간 TypeScript 가 잡는다.
 *
 * 클라이언트 안전:
 *   `import type` 만 쓴다(런타임 import 0). 브라우저 번들에 Prisma 런타임이 끌려오지 않는다.
 */

import type { ProductCategory } from "@prisma/client";

/**
 * 분류 → 화면 라벨. `Record<ProductCategory, string>` 이므로 **전수 대응이 강제**된다.
 * enum 에 값이 추가되면 여기서 build 가 깨진다(런타임까지 못 간다).
 */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  REAGENT: "시약",
  TOOL: "기구",
  EQUIPMENT: "장비",
  RAW_MATERIAL: "원료",
  CONSUMABLE: "소모품",
};

/** 화면 select 의 표시 순서. 스캔 입고 빈도 순. */
export const PRODUCT_CATEGORY_VALUES = Object.keys(
  PRODUCT_CATEGORY_LABELS,
) as ProductCategory[];

/**
 * 사용자가 고르지 않았을 때의 기본값 — 호영님 결정(2026-09-04): REAGENT.
 *
 * 근거(오분류의 비대칭성): 실제 시약을 소모품으로 넣으면 Lot·유효기간 관리가 빠져
 * 안전 이슈가 된다. 반대로 소모품을 시약으로 넣으면 불필요한 필드가 붙을 뿐이다.
 * 과분류가 저분류보다 안전하다.
 *
 * 🛑 `as` 를 붙이지 않는다. 선언만으로 TypeScript 가 enum 멤버인지 검사하게 둔다.
 */
export const FALLBACK_PRODUCT_CATEGORY: ProductCategory = "REAGENT";

/**
 * 분류가 사람이 고른 값인지 fallback 인지 — `Product.categorySource` 에 기록한다.
 * 이게 없으면 fallback 이 얼마나 무비판적으로 통과되는지 나중에 실측할 수 없고,
 * 오염이 보이지 않는 채로 쌓인다(호영님 조건 2 · `lotSource` 선례).
 */
export const CATEGORY_SOURCE = {
  /** 사용자가 화면에서 분류를 **실제로 건드렸다.** */
  USER_SELECTED: "USER_SELECTED",
  /** 사용자가 손대지 않아 선채움값이 그대로 통과했다. */
  FALLBACK: "FALLBACK",
  /**
   * 어느 쪽인지 **판단할 근거가 없다.**
   *   - 요청이 categoryTouched 를 안 보냈다(구 클라이언트·직접 호출)
   *   - 또는 판단 축이 없던 시기에 쌓인 행(2026-09-04 보정 대상)
   * 🛑 null 과 다르다. null = 컬럼 도입 전(구 314행). UNKNOWN = 도입 후인데 모른다.
   *    둘을 합치면 "언제부터 못 믿는가" 를 나중에 되물을 수 없다.
   */
  UNKNOWN: "UNKNOWN",
} as const;

export type CategorySource = (typeof CATEGORY_SOURCE)[keyof typeof CATEGORY_SOURCE];

/** 외부 입력(요청 body)이 실제 분류값인지 판정. 아니면 false — 조용히 통과시키지 않는다. */
export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && value in PRODUCT_CATEGORY_LABELS;
}

/**
 * 요청이 실은 분류를 무엇으로 확정했는지 판정한다.
 *
 * 🛑 값만으로는 판정할 수 없다 (2026-09-04 스모크 실측):
 *   화면이 fallback 을 **선채움해서 그대로 전송**하므로, 서버가 보기에는
 *   사람이 REAGENT 를 고른 요청과 아무것도 안 고른 요청이 **완전히 같다.**
 *   실제로 분류를 건드리지 않은 등록 3건이 전부 USER_SELECTED 로 기록됐고,
 *   그러면 이 컬럼의 존재 이유(fallback 이 얼마나 무비판적으로 통과되는가)가 사라진다.
 *   그래서 "건드렸는가" 를 클라이언트가 별도 축으로 보낸다(productNameDirty 선례).
 *
 * 🛑 "값이 fallback 과 같으면 FALLBACK" 은 기각된 안이다 — 실제로 시약을 고른 사람도
 *   FALLBACK 으로 찍혀 반대 방향 오염이 생긴다(호영님 판단 2026-09-04).
 *
 * @param touched 사용자가 분류 컨트롤을 실제로 조작했는가.
 *   undefined = 요청이 그 축을 아예 안 보냈다 → 판단 근거 없음 → UNKNOWN.
 */
export function resolveProductCategory(
  value: unknown,
  touched?: boolean,
): {
  category: ProductCategory;
  categorySource: CategorySource;
} {
  if (!isProductCategory(value)) {
    // 값 자체가 무효면 건드렸는지와 무관하게 fallback 이 들어간 것이다.
    return {
      category: FALLBACK_PRODUCT_CATEGORY,
      categorySource: CATEGORY_SOURCE.FALLBACK,
    };
  }
  if (touched === undefined) {
    return { category: value, categorySource: CATEGORY_SOURCE.UNKNOWN };
  }
  return {
    category: value,
    categorySource: touched ? CATEGORY_SOURCE.USER_SELECTED : CATEGORY_SOURCE.FALLBACK,
  };
}
