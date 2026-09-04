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
  USER_SELECTED: "USER_SELECTED",
  FALLBACK: "FALLBACK",
} as const;

export type CategorySource = (typeof CATEGORY_SOURCE)[keyof typeof CATEGORY_SOURCE];

/** 외부 입력(요청 body)이 실제 분류값인지 판정. 아니면 false — 조용히 통과시키지 않는다. */
export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && value in PRODUCT_CATEGORY_LABELS;
}

/**
 * 요청이 실은 분류를 무엇으로 확정했는지 한 번에 판정한다.
 * 유효하면 그대로 + USER_SELECTED, 아니면 fallback + FALLBACK.
 */
export function resolveProductCategory(value: unknown): {
  category: ProductCategory;
  categorySource: CategorySource;
} {
  return isProductCategory(value)
    ? { category: value, categorySource: CATEGORY_SOURCE.USER_SELECTED }
    : { category: FALLBACK_PRODUCT_CATEGORY, categorySource: CATEGORY_SOURCE.FALLBACK };
}
