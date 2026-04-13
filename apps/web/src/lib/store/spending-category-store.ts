/**
 * spending-category-store.ts
 *
 * 카테고리별 지출 통제 Zustand store.
 * SpendingCategory CRUD + CategoryBudget 관리 + 지출 현황 조회.
 */

import { create } from "zustand";

// ── 타입 ──

export interface SpendingCategory {
  id: string;
  organizationId: string;
  name: string;
  displayName: string;
  description: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  budgets?: CategoryBudgetRecord[];
}

export interface CategoryBudgetRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  yearMonth: string;
  amount: number;
  currency: string;
  warningPercent: number;
  softLimitPercent: number;
  hardStopPercent: number;
  controlRules: string[] | null;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
  };
}

export interface CategorySpendingItem {
  categoryId: string | null;
  categoryName: string;
  displayName: string;
  color: string;
  icon: string | null;
  committedSpend: number;
  budgetAmount: number | null;
  usagePercent: number | null;
  momChangePercent: number | null;
  status: "normal" | "warning" | "soft_limit" | "over_budget" | "no_budget";
  remaining: number | null;
  thresholds: {
    warningPercent: number;
    softLimitPercent: number;
    hardStopPercent: number;
  } | null;
}

export interface CategorySpendingSummary {
  organizationId: string;
  yearMonth: string;
  categories: CategorySpendingItem[];
  totalCommittedSpend: number;
  overBudgetRiskCount: number;
  unclassifiedCount: number;
  aggregatedAt: string;
}

// ── Store ──

interface SpendingCategoryStore {
  // 상태
  categories: SpendingCategory[];
  categoryBudgets: CategoryBudgetRecord[];
  spendingSummary: CategorySpendingSummary | null;
  isLoading: boolean;
  error: string | null;

  // 카테고리 CRUD
  fetchCategories: (organizationId: string) => Promise<void>;
  createCategory: (
    organizationId: string,
    data: {
      name: string;
      displayName: string;
      description?: string;
      color?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) => Promise<SpendingCategory>;
  updateCategory: (
    id: string,
    data: Partial<{
      displayName: string;
      description: string | null;
      color: string;
      icon: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // 예산 CRUD
  fetchCategoryBudgets: (
    organizationId: string,
    yearMonth?: string,
  ) => Promise<void>;
  setCategoryBudget: (
    organizationId: string,
    data: {
      categoryId: string;
      yearMonth: string;
      amount: number;
      warningPercent?: number;
      softLimitPercent?: number;
      hardStopPercent?: number;
      controlRules?: string[];
    },
  ) => Promise<CategoryBudgetRecord>;
  updateCategoryBudget: (
    id: string,
    data: Partial<{
      amount: number;
      warningPercent: number;
      softLimitPercent: number;
      hardStopPercent: number;
      controlRules: string[];
      isActive: boolean;
    }>,
  ) => Promise<void>;
  deleteCategoryBudget: (id: string) => Promise<void>;

  // 지출 현황
  fetchSpendingSummary: (
    organizationId: string,
    yearMonth?: string,
  ) => Promise<void>;
}

export const useSpendingCategoryStore = create<SpendingCategoryStore>(
  (set, get) => ({
    categories: [],
    categoryBudgets: [],
    spendingSummary: null,
    isLoading: false,
    error: null,

    // ── 카테고리 ──

    fetchCategories: async (organizationId) => {
      set({ isLoading: true, error: null });
      try {
        const res = await fetch(
          `/api/spending-categories?organizationId=${organizationId}`,
        );
        if (!res.ok) throw new Error("카테고리 목록 조회 실패");
        const data = await res.json();
        set({ categories: data.categories, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    createCategory: async (organizationId, data) => {
      const res = await fetch("/api/spending-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "카테고리 생성 실패");
      }
      const { category } = await res.json();
      set((s) => ({ categories: [...s.categories, category] }));
      return category;
    },

    updateCategory: async (id, data) => {
      const res = await fetch(`/api/spending-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "카테고리 수정 실패");
      }
      const { category } = await res.json();
      set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? category : c)),
      }));
    },

    deleteCategory: async (id) => {
      const res = await fetch(`/api/spending-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "카테고리 삭제 실패");
      }
      set((s) => ({
        categories: s.categories.filter((c) => c.id !== id),
      }));
    },

    // ── 예산 ──

    fetchCategoryBudgets: async (organizationId, yearMonth) => {
      set({ isLoading: true, error: null });
      try {
        const params = new URLSearchParams({ organizationId });
        if (yearMonth) params.set("yearMonth", yearMonth);
        const res = await fetch(`/api/category-budgets?${params}`);
        if (!res.ok) throw new Error("카테고리 예산 조회 실패");
        const data = await res.json();
        set({ categoryBudgets: data.budgets, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    setCategoryBudget: async (organizationId, data) => {
      const res = await fetch("/api/category-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "예산 설정 실패");
      }
      const { budget } = await res.json();
      set((s) => {
        const existing = s.categoryBudgets.findIndex(
          (b) =>
            b.categoryId === budget.categoryId &&
            b.yearMonth === budget.yearMonth,
        );
        if (existing >= 0) {
          const updated = [...s.categoryBudgets];
          updated[existing] = budget;
          return { categoryBudgets: updated };
        }
        return { categoryBudgets: [...s.categoryBudgets, budget] };
      });
      return budget;
    },

    updateCategoryBudget: async (id, data) => {
      const res = await fetch(`/api/category-budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "예산 수정 실패");
      }
      const { budget } = await res.json();
      set((s) => ({
        categoryBudgets: s.categoryBudgets.map((b) =>
          b.id === id ? budget : b,
        ),
      }));
    },

    deleteCategoryBudget: async (id) => {
      const res = await fetch(`/api/category-budgets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "예산 삭제 실패");
      }
      set((s) => ({
        categoryBudgets: s.categoryBudgets.filter((b) => b.id !== id),
      }));
    },

    // ── 지출 현황 ──

    fetchSpendingSummary: async (organizationId, yearMonth) => {
      set({ isLoading: true, error: null });
      try {
        const params = new URLSearchParams({ organizationId });
        if (yearMonth) params.set("yearMonth", yearMonth);
        const res = await fetch(`/api/category-spending?${params}`);
        if (!res.ok) throw new Error("지출 현황 조회 실패");
        const data = await res.json();
        set({ spendingSummary: data, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
  }),
);
