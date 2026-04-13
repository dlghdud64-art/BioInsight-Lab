/**
 * spending-category-schema.ts
 *
 * Zod validation schemas for SpendingCategory and CategoryBudget.
 * 카테고리별 지출 통제 입력 검증.
 */

import { z } from "zod";

// ── SpendingCategory ──

export const createSpendingCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리 내부 키는 필수입니다")
    .max(50, "카테고리 내부 키는 50자 이내입니다")
    .regex(/^[a-z0-9_-]+$/, "영문 소문자, 숫자, -, _ 만 사용 가능합니다"),
  displayName: z
    .string()
    .min(1, "카테고리 표시명은 필수입니다")
    .max(100, "카테고리 표시명은 100자 이내입니다"),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 hex 색상 코드가 아닙니다")
    .optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateSpendingCategorySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ── CategoryBudget ──

export const createCategoryBudgetSchema = z.object({
  categoryId: z.string().min(1, "카테고리 ID는 필수입니다"),
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 형식이어야 합니다"),
  amount: z
    .number()
    .int()
    .min(0, "예산 금액은 0 이상이어야 합니다"),
  currency: z.string().default("KRW"),
  warningPercent: z.number().int().min(0).max(100).default(70),
  softLimitPercent: z.number().int().min(0).max(100).default(90),
  hardStopPercent: z.number().int().min(0).max(100).default(100),
  controlRules: z
    .array(z.enum(["warning", "soft_limit", "hard_stop", "approval_required"]))
    .optional(),
});

export const updateCategoryBudgetSchema = z.object({
  amount: z.number().int().min(0).optional(),
  warningPercent: z.number().int().min(0).max(100).optional(),
  softLimitPercent: z.number().int().min(0).max(100).optional(),
  hardStopPercent: z.number().int().min(0).max(100).optional(),
  controlRules: z
    .array(z.enum(["warning", "soft_limit", "hard_stop", "approval_required"]))
    .optional(),
  isActive: z.boolean().optional(),
});

// ── 타입 export ──

export type CreateSpendingCategoryInput = z.infer<typeof createSpendingCategorySchema>;
export type UpdateSpendingCategoryInput = z.infer<typeof updateSpendingCategorySchema>;
export type CreateCategoryBudgetInput = z.infer<typeof createCategoryBudgetSchema>;
export type UpdateCategoryBudgetInput = z.infer<typeof updateCategoryBudgetSchema>;

// ── 기본 시드 카테고리 ──

export const DEFAULT_SPENDING_CATEGORIES = [
  {
    name: "reagents-chemicals",
    displayName: "시약 및 화합물",
    description: "실험용 시약, 화학 물질, 용매 등",
    color: "#6366f1",
    icon: "Beaker",
    sortOrder: 0,
  },
  {
    name: "consumables",
    displayName: "소모품",
    description: "피펫 팁, 튜브, 글러브 등 일회성 소모품",
    color: "#8b5cf6",
    icon: "Package",
    sortOrder: 1,
  },
  {
    name: "cell-culture-media",
    displayName: "세포 배양 배지",
    description: "배지, 혈청, 보충제 등 세포 배양 관련",
    color: "#ec4899",
    icon: "FlaskConical",
    sortOrder: 2,
  },
  {
    name: "antibodies-proteins",
    displayName: "항체 및 단백질",
    description: "1차/2차 항체, 재조합 단백질, 효소 등",
    color: "#f59e0b",
    icon: "Dna",
    sortOrder: 3,
  },
] as const;

/**
 * PurchaseRecord.category (자유 문자열) → SpendingCategory.name 매핑 규칙.
 * 기존 데이터를 카테고리에 매핑할 때 사용.
 */
export const CATEGORY_MAPPING_RULES: Record<string, string[]> = {
  "reagents-chemicals": [
    "시약", "화합물", "reagent", "chemical", "solvent", "용매",
    "buffer", "완충액", "stain", "염색", "dye",
  ],
  "consumables": [
    "소모품", "consumable", "tip", "팁", "tube", "튜브",
    "glove", "글러브", "plate", "플레이트", "filter", "필터",
  ],
  "cell-culture-media": [
    "배지", "media", "medium", "serum", "혈청", "supplement",
    "배양", "culture", "FBS", "DMEM", "RPMI",
  ],
  "antibodies-proteins": [
    "항체", "antibody", "protein", "단백질", "enzyme", "효소",
    "recombinant", "재조합", "IgG", "conjugate",
  ],
};

/**
 * PurchaseRecord.category 문자열을 SpendingCategory.name으로 **제안** 매핑.
 *
 * ⚠️ IMPORTANT: 이 함수는 backfill/proposal/추천 용도로만 사용해야 합니다.
 * 실제 예산 집계, 승인 검증, MOM% 계산에는 반드시 `normalizedCategoryId`
 * (승인/PO 시점에 고정 저장된 FK)를 사용하세요.
 * fuzzy 매핑 결과를 canonical truth로 쓰면 과거 숫자가 흔들립니다.
 *
 * 용도:
 * - 기존 PurchaseRecord backfill 시 카테고리 추천
 * - 사용자에게 "이 품목은 ○○ 카테고리로 분류하시겠습니까?" 제안
 * - 미분류 품목 일괄 재분류 화면에서의 기본값 제안
 *
 * @returns SpendingCategory.name 제안값. 매칭 실패 시 "unclassified".
 */
export function suggestCategoryMapping(
  rawCategory: string | null | undefined,
): string {
  if (!rawCategory) return "other";

  const lower = rawCategory.toLowerCase().trim();

  // 정확 매치 (name 자체)
  const knownNames = Object.keys(CATEGORY_MAPPING_RULES);
  if (knownNames.includes(lower)) return lower;

  // 키워드 매치
  for (const [categoryName, keywords] of Object.entries(CATEGORY_MAPPING_RULES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return categoryName;
      }
    }
  }

  return "unclassified";
}
