/**
 * 예산 통제 스토어 — Single Source of Truth
 *
 * 예산 목록, 통제 파생 상태, 필터, AI 인사이트를
 * 이 스토어에서 관리한다.
 *
 * Flow scope: /dashboard/budget 에서 활성.
 */
import { create } from "zustand";

// ── Types ──
export interface BudgetUsage {
  totalSpent: number;
  usageRate: number;
  remaining: number;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  organizationId?: string | null;
  targetDepartment?: string | null;
  projectName?: string | null;
  description?: string | null;
  usage?: BudgetUsage;
}

export interface BudgetControl {
  total: number;
  reserved: number;
  committed: number;
  actual: number;
  available: number;
  burnRate: number;
  risk: "safe" | "warning" | "critical" | "over" | "ended" | "upcoming";
}

export interface BudgetWithControl {
  budget: Budget;
  ctrl: BudgetControl;
}

// ── Derived calculation ──
export function deriveBudgetControl(b: Budget): BudgetControl {
  const total = b.amount;
  const actual = b.usage?.totalSpent ?? 0;
  const reserved = 0;
  const committed = 0;
  const available = Math.max(total - reserved - committed - actual, 0);
  const burnRate = total > 0 ? ((reserved + committed + actual) / total) * 100 : 0;

  const now = new Date();
  const start = new Date(b.periodStart);
  const end = new Date(b.periodEnd);

  let risk: BudgetControl["risk"] = "safe";
  if (now > end) risk = "ended";
  else if (now < start) risk = "upcoming";
  else if (burnRate > 100) risk = "over";
  else if (burnRate >= 80) risk = "critical";
  else if (burnRate >= 60) risk = "warning";

  return { total, reserved, committed, actual, available, burnRate, risk };
}

// ── Monthly mock data for chart ──
export interface MonthlySpending {
  month: string;
  actual: number;
  budget: number;
}

export function generateMonthlyData(budgets: Budget[]): MonthlySpending[] {
  const months = ["1월", "2월", "3월", "4월", "5월", "6월"];
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const monthlyBudget = Math.round(totalBudget / 12);
  const totalSpent = budgets.reduce((s, b) => s + (b.usage?.totalSpent ?? 0), 0);

  // 과거 5개월 실적 mock + 예측
  return months.map((m, i) => {
    const factor = [0.7, 0.85, 0.9, 1.05, 1.1, 0.95][i] ?? 1;
    const isCurrentOrFuture = i >= new Date().getMonth();
    return {
      month: m,
      actual: isCurrentOrFuture
        ? Math.round(monthlyBudget * factor * 0.6) // 예측치
        : Math.round(monthlyBudget * factor),
      budget: monthlyBudget,
    };
  });
}

// ── Department aggregation ──
export interface DepartmentSpending {
  department: string;
  spent: number;
  budget: number;
  rate: number;
}

export function aggregateDepartments(budgets: Budget[]): DepartmentSpending[] {
  const deptMap: Record<string, { spent: number; budget: number }> = {};
  for (const b of budgets) {
    const dept = b.targetDepartment || "미지정";
    if (!deptMap[dept]) deptMap[dept] = { spent: 0, budget: 0 };
    deptMap[dept].spent += b.usage?.totalSpent ?? 0;
    deptMap[dept].budget += b.amount;
  }
  return Object.entries(deptMap)
    .map(([department, { spent, budget }]) => ({
      department,
      spent,
      budget,
      rate: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
}

// ── Store ──
interface BudgetStoreState {
  budgets: Budget[];
  isFetching: boolean;
  searchQuery: string;
  setBudgets: (budgets: Budget[]) => void;
  setIsFetching: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  addBudget: (b: Budget) => void;
  updateBudget: (id: string, data: Partial<Budget>) => void;
  removeBudget: (id: string) => void;
}

export const useBudgetStore = create<BudgetStoreState>((set) => ({
  budgets: [],
  isFetching: true,
  searchQuery: "",
  setBudgets: (budgets) => set({ budgets }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  addBudget: (b) => set((state) => ({ budgets: [b, ...state.budgets] })),
  updateBudget: (id, data) =>
    set((state) => ({
      budgets: state.budgets.map((b) => (b.id === id ? { ...b, ...data } : b)),
    })),
  removeBudget: (id) =>
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) })),
}));
