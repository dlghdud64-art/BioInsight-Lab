import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuoteDraftItem {
  id: string;
  productId: string;
  productName: string;
  vendorId?: string;
  vendorName?: string;
  brand?: string;
  quantity: number;
  unitPrice?: number;
  currency?: string;
  lineTotal?: number;
  notes?: string;
  isPurchased?: boolean;
}

export interface QuoteDraft {
  quoteListId: string | null;
  title: string;
  message: string;
  status: "draft" | "saved" | "saving" | "failed";
  items: QuoteDraftItem[];
  totals: {
    itemCount: number;
    totalAmount: number;
  };
  lastSaved?: Date;
  error?: string;
}

interface QuoteDraftState extends QuoteDraft {
  // Actions
  setQuoteListId: (id: string) => void;
  setTitle: (title: string) => void;
  setMessage: (message: string) => void;
  setStatus: (status: QuoteDraft["status"]) => void;
  setError: (error: string | undefined) => void;
  
  addItem: (item: QuoteDraftItem) => void;
  updateItem: (itemId: string, updates: Partial<QuoteDraftItem>) => void;
  removeItem: (itemId: string) => void;
  setItems: (items: QuoteDraftItem[]) => void;
  
  calculateTotals: () => void;
  hydrate: (data: Partial<QuoteDraft>) => void;
  reset: () => void;
}

const initialState: QuoteDraft = {
  quoteListId: null,
  title: "새 견적 요청서",
  message: "",
  status: "draft",
  items: [],
  totals: {
    itemCount: 0,
    totalAmount: 0,
  },
};

export const useQuoteDraftStore = create<QuoteDraftState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setQuoteListId: (id) => set({ quoteListId: id }),
      
      setTitle: (title) => set({ title }),
      
      setMessage: (message) => set({ message }),
      
      setStatus: (status) => {
        const updates: Partial<QuoteDraft> = { status };
        if (status === "saved") {
          updates.lastSaved = new Date();
          updates.error = undefined;
        }
        set(updates);
      },
      
      setError: (error) => set({ error, status: "failed" }),

      addItem: (item) =>
        set((state) => {
          const newItems = [...state.items, item];
          const totals = {
            itemCount: newItems.length,
            totalAmount: newItems.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
          };
          return { items: newItems, totals, status: "draft" };
        }),

      updateItem: (itemId, updates) =>
        set((state) => {
          const newItems = state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...updates,
                  // quantity나 unitPrice가 변경되면 lineTotal 재계산
                  lineTotal:
                    updates.quantity !== undefined || updates.unitPrice !== undefined
                      ? (updates.quantity ?? item.quantity) *
                        (updates.unitPrice ?? item.unitPrice ?? 0)
                      : item.lineTotal,
                }
              : item
          );
          const totals = {
            itemCount: newItems.length,
            totalAmount: newItems.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
          };
          return { items: newItems, totals, status: "draft" };
        }),

      removeItem: (itemId) =>
        set((state) => {
          const newItems = state.items.filter((item) => item.id !== itemId);
          const totals = {
            itemCount: newItems.length,
            totalAmount: newItems.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
          };
          return { items: newItems, totals, status: "draft" };
        }),

      setItems: (items) => {
        const totals = {
          itemCount: items.length,
          totalAmount: items.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
        };
        set({ items, totals });
      },

      calculateTotals: () =>
        set((state) => ({
          totals: {
            itemCount: state.items.length,
            totalAmount: state.items.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
          },
        })),

      hydrate: (data) =>
        set((state) => {
          const newState = { ...state, ...data };
          if (data.items) {
            newState.totals = {
              itemCount: data.items.length,
              totalAmount: data.items.reduce((sum, i) => sum + (i.lineTotal || 0), 0),
            };
          }
          return newState;
        }),

      reset: () => set(initialState),
    }),
    {
      name: "quote-draft-storage",
      // localStorage에 저장할 항목 선택 (quoteListId와 lastSaved는 제외)
      partialize: (state) => ({
        quoteListId: state.quoteListId,
        title: state.title,
        message: state.message,
        items: state.items,
        totals: state.totals,
      }),
    }
  )
);












