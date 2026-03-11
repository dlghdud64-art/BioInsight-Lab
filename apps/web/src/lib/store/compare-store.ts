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

interface CompareState {
  /** 비교 대상 제품 ID 목록 (최대 5개) */
  productIds: string[];
  /** 비교 대상에 추가 */
  addProduct: (productId: string) => void;
  /** 비교 대상에서 개별 제거 */
  removeProduct: (productId: string) => void;
  /** 비교 대상 전체 비우기 */
  clearProducts: () => void;
  /** 비교 대상 포함 여부 확인 */
  hasProduct: (productId: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],
      addProduct: (productId: string) => {
        const { productIds } = get();
        if (productIds.length >= 5) {
          alert("최대 5개까지 비교할 수 있습니다.");
          return;
        }
        if (!productIds.includes(productId)) {
          set({ productIds: [...productIds, productId] });
        }
      },
      removeProduct: (productId: string) => {
        set({
          productIds: get().productIds.filter((id) => id !== productId),
        });
      },
      clearProducts: () => {
        set({ productIds: [] });
      },
      hasProduct: (productId: string) => {
        return get().productIds.includes(productId);
      },
    }),
    {
      name: "compare-storage",
    }
  )
);