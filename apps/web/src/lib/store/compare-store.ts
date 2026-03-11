/**
 * 비교 대상 스토어 — Single Source of Truth
 *
 * 모든 비교 관련 UI(검색 결과 배지, 상단 비교 바, 비교 페이지)가
 * 이 스토어의 productIds를 참조한다.
 *
 * 상태 변경 허용 경우:
 *   1. 개별 제거  — removeProduct
 *   2. 전체 비우기 — clearProducts
 *   3. 비교 종료 후 초기화 — clearProducts
 * 자동 초기화 금지: route 이동, 검색 조건 변경 시 절대 해제하지 않는다.
 *
 * localStorage key: "compare-storage"
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProductMeta {
  name: string;
  brand?: string;
}

interface CompareState {
  /** 비교 대상 제품 ID 목록 (최대 5개) */
  productIds: string[];
  /** 제품 ID → 이름/브랜드 매핑 (표시용) */
  productMeta: Record<string, ProductMeta>;
  /** 비교 대상에 추가 (meta 전달 시 이름 저장) */
  addProduct: (productId: string, meta?: ProductMeta) => void;
  /** 비교 대상에서 개별 제거 */
  removeProduct: (productId: string) => void;
  /** 비교 대상 전체 비우기 */
  clearProducts: () => void;
  /** 비교 대상 포함 여부 확인 */
  hasProduct: (productId: string) => boolean;
  /** 제품 표시명 조회 */
  getDisplayName: (productId: string) => string;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],
      productMeta: {},
      addProduct: (productId: string, meta?: ProductMeta) => {
        const { productIds, productMeta } = get();
        if (productIds.length >= 5) {
          alert("최대 5개까지 비교할 수 있습니다.");
          return;
        }
        if (!productIds.includes(productId)) {
          set({
            productIds: [...productIds, productId],
            ...(meta ? { productMeta: { ...productMeta, [productId]: meta } } : {}),
          });
        } else if (meta && !productMeta[productId]) {
          // 이미 추가되었지만 meta가 없으면 보충
          set({ productMeta: { ...productMeta, [productId]: meta } });
        }
      },
      removeProduct: (productId: string) => {
        const { productMeta, ...rest } = get();
        const { [productId]: _, ...remainingMeta } = productMeta;
        set({
          productIds: get().productIds.filter((id) => id !== productId),
          productMeta: remainingMeta,
        });
      },
      clearProducts: () => {
        set({ productIds: [], productMeta: {} });
      },
      hasProduct: (productId: string) => {
        return get().productIds.includes(productId);
      },
      getDisplayName: (productId: string) => {
        const meta = get().productMeta[productId];
        return meta?.name || meta?.brand || "";
      },
    }),
    {
      name: "compare-storage",
    }
  )
);