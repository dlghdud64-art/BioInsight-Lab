/**
 * 예산 통제 스토어 — Single Source of Truth
 *
 * Zustand + Supabase 직접 연동
 * 예산 목록, 통제 파생 상태, 필터, AI 인사이트를 관리한다.
 *
 * Flow scope: /dashboard/budget 에서 활성.
 *
 * [Phase 1 Ontology] DB 매핑을 ontology/mappers로 위임.
 * Budget → BudgetObject 전환은 Phase 2에서 완료. 현재는 backward compat 유지.
 */
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import {
  mapBudgetRowToObject,
  type SupabaseBudgetRow,
  type BudgetObject,
  type BudgetControlState,
} from "@/lib/ontology";

// ── Types (backward compat — Phase 2에서 BudgetObject로 일원화) ──
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

// ── Ontology Domain Object → legacy Budget 변환 (Phase 2에서 제거) ──
function ontologyToBudget(obj: BudgetObject): Budget {
  return {
    id: obj.objectId,
    name: obj.displayName,
    amount: obj.allocatedAmount,
    currency: obj.currency,
    periodStart: obj.periodStart,
    periodEnd: obj.periodEnd,
    organizationId: null,
    targetDepartment: obj.departmentName,
    projectName: obj.projectName,
    description: null,
    usage: {
      totalSpent: obj.controlState.actual,
      usageRate: obj.controlState.burnRate,
      remaining: obj.controlState.available,
    },
  };
}

function ontologyToControl(ctrl: BudgetControlState, total: number): BudgetControl {
  return {
    total,
    reserved: ctrl.reserved,
    committed: ctrl.committed,
    actual: ctrl.actual,
    available: ctrl.available,
    burnRate: ctrl.burnRate,
    risk: ctrl.riskLevel,
  };
}

/**
 * Supabase row → Budget (ontology mapper 경유)
 * 기존 인라인 매핑 대신 ontology/mappers/mapBudgetRowToObject를 거쳐
 * Domain Object를 만든 뒤 legacy Budget으로 변환한다.
 */
function mapRowToBudget(row: SupabaseBudgetRow): Budget {
  const domainObj = mapBudgetRowToObject(row);
  return ontologyToBudget(domainObj);
}

// ── Derived calculation (ontology 경유) ──
export function deriveBudgetControl(b: Budget): BudgetControl {
  // Phase 1: ontology controlState와 동일한 계산 로직 사용
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

// ── Monthly chart data ──
export interface MonthlySpending {
  month: string;
  actual: number;
  budget: number;
}

export function generateMonthlyData(budgets: Budget[]): MonthlySpending[] {
  const months = ["1월", "2월", "3월", "4월", "5월", "6월"];
  const totalBudget = budgets.reduce((s: number, b: Budget) => s + b.amount, 0);
  const monthlyBudget = Math.round(totalBudget / 12);

  return months.map((m, i) => {
    const factor = [0.7, 0.85, 0.9, 1.05, 1.1, 0.95][i] ?? 1;
    const isCurrentOrFuture = i >= new Date().getMonth();
    return {
      month: m,
      actual: isCurrentOrFuture
        ? Math.round(monthlyBudget * factor * 0.6)
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
  error: string | null;

  // Setters
  setBudgets: (budgets: Budget[]) => void;
  setIsFetching: (v: boolean) => void;
  setSearchQuery: (q: string) => void;

  // Supabase CRUD
  fetchBudgets: () => Promise<void>;
  /** Supabase Realtime 구독. budgets 변경 시 자동 refetch */
  subscribe: () => () => void;
  createBudget: (data: {
    name: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    targetDepartment?: string | null;
    projectName?: string | null;
    description?: string | null;
    organizationId?: string | null;
  }) => Promise<Budget | null>;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // Local-only (optimistic)
  addBudget: (b: Budget) => void;
  removeBudget: (id: string) => void;
}

export const useBudgetStore = create<BudgetStoreState>((set, get) => ({
  budgets: [],
  isFetching: true,
  searchQuery: "",
  error: null,

  setBudgets: (budgets) => set({ budgets }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  addBudget: (b) => set((state) => ({ budgets: [b, ...state.budgets] })),
  removeBudget: (id) =>
    set((state) => ({ budgets: state.budgets.filter((b: Budget) => b.id !== id) })),

  // ── Supabase: 전체 조회 ──
  fetchBudgets: async () => {
    set({ isFetching: true, error: null });
    try {
      // Supabase 테이블이 있으면 사용, 없으면 기존 API fallback
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Supabase 테이블 없으면 기존 Prisma API fallback
        console.warn("[budget-store] Supabase 조회 실패, API fallback:", error.message);
        const res = await fetch("/api/budgets");
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json.budgets) ? json.budgets : [];
          set({ budgets: list, isFetching: false });
        } else {
          set({ isFetching: false, error: "예산 목록 조회 실패" });
        }
        return;
      }

      const budgets = (data as SupabaseBudgetRow[]).map(mapRowToBudget);
      set({ budgets, isFetching: false });
    } catch (err) {
      console.error("[budget-store] fetchBudgets error:", err);
      // 최종 fallback: 기존 API
      try {
        const res = await fetch("/api/budgets");
        if (res.ok) {
          const json = await res.json();
          set({ budgets: Array.isArray(json.budgets) ? json.budgets : [], isFetching: false });
        }
      } catch {
        set({ isFetching: false, error: "예산 데이터를 불러올 수 없습니다." });
      }
    }
  },

  // ── Supabase: 생성 ──
  createBudget: async (data) => {
    set({ error: null });
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // Supabase insert 시도
      if (userId) {
        const { data: inserted, error } = await supabase
          .from("budgets")
          .insert({
            user_id: userId,
            name: data.name,
            amount: data.amount,
            currency: data.currency,
            period_start: data.periodStart,
            period_end: data.periodEnd,
            target_department: data.targetDepartment || null,
            project_name: data.projectName || null,
            description: data.description || null,
            organization_id: data.organizationId || null,
          })
          .select()
          .single();

        if (!error && inserted) {
          const budget = mapRowToBudget(inserted as SupabaseBudgetRow);
          set((state) => ({ budgets: [budget, ...state.budgets] }));
          return budget;
        }
        console.warn("[budget-store] Supabase insert 실패, API fallback:", error?.message);
      }

      // Fallback: 기존 Prisma API
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        set({ error: json?.error || "예산 등록 실패" });
        return null;
      }
      const apiBudget = json.budget;
      const budget: Budget = {
        id: apiBudget?.id ?? String(Date.now()),
        name: apiBudget?.name ?? data.name,
        amount: apiBudget?.amount ?? data.amount,
        currency: apiBudget?.currency ?? data.currency,
        periodStart: apiBudget?.periodStart ?? data.periodStart,
        periodEnd: apiBudget?.periodEnd ?? data.periodEnd,
        targetDepartment: data.targetDepartment,
        projectName: apiBudget?.projectName ?? data.projectName,
        description: apiBudget?.description ?? data.description,
        usage: { totalSpent: 0, usageRate: 0, remaining: data.amount },
      };
      set((state) => ({ budgets: [budget, ...state.budgets] }));
      return budget;
    } catch (err) {
      console.error("[budget-store] createBudget error:", err);
      set({ error: "예산 등록 중 오류가 발생했습니다." });
      return null;
    }
  },

  // ── Supabase: 수정 ──
  updateBudget: async (id, data) => {
    set({ error: null });
    // 즉시 낙관적 업데이트
    set((state) => ({
      budgets: state.budgets.map((b: Budget) => (b.id === id ? { ...b, ...data } : b)),
    }));

    try {
      const updatePayload: Record<string, unknown> = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.amount !== undefined) updatePayload.amount = data.amount;
      if (data.currency !== undefined) updatePayload.currency = data.currency;
      if (data.periodStart !== undefined) updatePayload.period_start = data.periodStart;
      if (data.periodEnd !== undefined) updatePayload.period_end = data.periodEnd;
      if (data.targetDepartment !== undefined) updatePayload.target_department = data.targetDepartment;
      if (data.projectName !== undefined) updatePayload.project_name = data.projectName;
      if (data.description !== undefined) updatePayload.description = data.description;

      const { error } = await supabase
        .from("budgets")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.warn("[budget-store] Supabase update 실패, API fallback:", error.message);
        await fetch(`/api/budgets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
    } catch (err) {
      console.error("[budget-store] updateBudget error:", err);
    }
  },

  // ── Realtime: Supabase postgres_changes 구독 ──
  subscribe: () => {
    const channel = supabase
      .channel("budgets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budgets" },
        () => {
          get().fetchBudgets();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // ── Supabase: 삭제 ──
  deleteBudget: async (id) => {
    // 낙관적 삭제
    const prev = get().budgets;
    set((state) => ({ budgets: state.budgets.filter((b: Budget) => b.id !== id) }));

    try {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) {
        console.warn("[budget-store] Supabase delete 실패, API fallback:", error.message);
        const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
        if (!res.ok) {
          // 롤백
          set({ budgets: prev, error: "예산 삭제 실패" });
        }
      }
    } catch (err) {
      console.error("[budget-store] deleteBudget error:", err);
      set({ budgets: prev, error: "예산 삭제 중 오류 발생" });
    }
  },
}));
