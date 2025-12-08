import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompareState {
  productIds: string[];
  addProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  clearProducts: () => void;
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



interface CompareState {
  productIds: string[];
  addProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  clearProducts: () => void;
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



interface CompareState {
  productIds: string[];
  addProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  clearProducts: () => void;
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

