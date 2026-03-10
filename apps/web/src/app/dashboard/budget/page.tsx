"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, Calendar, Wallet, TrendingUp,
  AlertTriangle, Loader2, Search, Filter, ArrowRight,
  ShoppingCart, Clock, CheckCircle2, AlertCircle, XCircle,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface Budget {
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
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
}

type BudgetStatus = "active" | "upcoming" | "ending_soon" | "ended" | "warning" | "exceeded";

const BUDGET_DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "공정개발팀", label: "공정개발팀" },
  { value: "기초연구팀", label: "기초연구팀" },
  { value: "품질관리(QC)팀", label: "품질관리(QC)팀" },
  { value: "전체(공용 예산)", label: "전체(공용 예산)" },
];

const STATUS_CONFIG: Record<BudgetStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "운영 중", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  upcoming: { label: "시작 전", color: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock },
  ending_soon: { label: "종료 예정", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  ended: { label: "종료됨", color: "bg-slate-100 text-slate-500 border-slate-200", icon: XCircle },
  warning: { label: "예산 주의", color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  exceeded: { label: "초과", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "운영 중" },
  { value: "upcoming", label: "시작 전" },
  { value: "ending_soon", label: "종료 예정" },
  { value: "ended", label: "종료됨" },
  { value: "warning", label: "예산 주의" },
  { value: "exceeded", label: "초과" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "usage_desc", label: "사용률 높은 순" },
  { value: "usage_asc", label: "사용률 낮은 순" },
  { value: "remaining_asc", label: "잔여 금액 적은 순" },
  { value: "period_end_asc", label: "종료일 가까운 순" },
  { value: "name_asc", label: "이름순" },
];

function getBudgetStatus(budget: Budget): BudgetStatus {
  const now = new Date();
  const start = new Date(budget.periodStart);
  const end = new Date(budget.periodEnd);
  const usageRate = budget.usage?.usageRate ?? 0;

  if (usageRate > 100) return "exceeded";
  if (usageRate >= 80) return "warning";
  if (now < start) return "upcoming";
  if (now > end) return "ended";

  const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilEnd <= 14) return "ending_soon";

  return "active";
}

function formatCurrency(amount: number, currency: string = "KRW"): string {
  if (currency === "KRW") return `₩${amount.toLocaleString("ko-KR")}`;
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${amount.toLocaleString("ko-KR")} ${currency}`;
}

export default function BudgetPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // 필터/정렬 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("usage_desc");

  const fetchActiveOrg = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const json = await res.json();
      const orgs = Array.isArray(json.organizations) ? json.organizations : [];
      if (orgs.length > 0) setActiveOrgId(orgs[0].id);
    } catch (e) {
      console.error("[BudgetPage] Failed to fetch active org:", e);
    }
  }, []);

  const fetchBudgets = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsFetching(true);
      const res = await fetch("/api/budgets");
      if (!res.ok) return;
      const json = await res.json();
      setBudgets(Array.isArray(json.budgets) ? json.budgets : []);
    } catch (e) {
      console.error("[BudgetPage] Failed to fetch budgets:", e);
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    fetchActiveOrg();
  }, [fetchBudgets, fetchActiveOrg]);

  // 필터/정렬된 목록
  const filteredBudgets = useMemo(() => {
    let items = budgets;

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.projectName && b.projectName.toLowerCase().includes(q)) ||
          (b.targetDepartment && b.targetDepartment.toLowerCase().includes(q))
      );
    }

    // 상태 필터
    if (statusFilter !== "all") {
      items = items.filter((b) => getBudgetStatus(b) === statusFilter);
    }

    // 부서 필터
    if (deptFilter !== "all") {
      items = items.filter((b) => b.targetDepartment === deptFilter);
    }

    // 정렬
    items = [...items].sort((a, b) => {
      const aRate = a.usage?.usageRate ?? 0;
      const bRate = b.usage?.usageRate ?? 0;
      switch (sortBy) {
        case "usage_desc": return bRate - aRate;
        case "usage_asc": return aRate - bRate;
        case "remaining_asc": return (a.usage?.remaining ?? a.amount) - (b.usage?.remaining ?? b.amount);
        case "period_end_asc": return new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime();
        case "name_asc": return a.name.localeCompare(b.name, "ko");
        default: return 0;
      }
    });

    return items;
  }, [budgets, searchQuery, statusFilter, deptFilter, sortBy]);

  // 요약 KPI
  const summaryKPI = useMemo(() => {
    const total = budgets.reduce((s, b) => s + b.amount, 0);
    const spent = budgets.reduce((s, b) => s + (b.usage?.totalSpent ?? 0), 0);
    const warningCount = budgets.filter((b) => {
      const st = getBudgetStatus(b);
      return st === "warning" || st === "exceeded";
    }).length;
    const activeCount = budgets.filter((b) => getBudgetStatus(b) === "active").length;
    return { total, spent, remaining: total - spent, rate: total > 0 ? Math.round((spent / total) * 100) : 0, warningCount, activeCount };
  }, [budgets]);

  const handleAddBudget = async (formData: {
    name: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    targetDepartment?: string | null;
    projectName?: string | null;
    description?: string | null;
    warningThreshold?: number;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const cleanAmount = typeof formData.amount === 'string'
        ? Number(String(formData.amount).replace(/[^0-9]/g, ""))
        : formData.amount;

      const isEdit = !!editingBudget;
      const url = isEdit ? `/api/budgets/${editingBudget!.id}` : "/api/budgets";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? {
            name: formData.name,
            amount: cleanAmount,
            currency: formData.currency,
            periodStart: formData.periodStart,
            periodEnd: formData.periodEnd,
            projectName: formData.projectName ?? null,
            description: formData.description ?? null,
          }
        : {
            name: formData.name,
            amount: cleanAmount,
            currency: formData.currency,
            periodStart: formData.periodStart,
            periodEnd: formData.periodEnd,
            projectName: formData.projectName,
            description: formData.description,
            organizationId: activeOrgId,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (json as any)?.error || (json as any)?.details || "예산 반영 중 오류가 발생했습니다.";
        setSubmitError(message);
        return;
      }

      const apiBudget = (json as any).budget;
      const mappedBudget: Budget = {
        id: apiBudget?.id ?? String(Date.now()),
        name: apiBudget?.name ?? formData.name ?? "신규 예산",
        amount: apiBudget?.amount ?? formData.amount ?? 0,
        currency: apiBudget?.currency ?? formData.currency ?? "KRW",
        periodStart: apiBudget?.periodStart ?? formData.periodStart,
        periodEnd: apiBudget?.periodEnd ?? formData.periodEnd,
        targetDepartment: formData.targetDepartment ?? null,
        projectName: apiBudget?.projectName ?? formData.projectName ?? null,
        description: apiBudget?.description ?? formData.description ?? null,
        usage: { totalSpent: 0, usageRate: 0, remaining: apiBudget?.amount ?? formData.amount ?? 0 },
      };

      if (editingBudget) {
        setBudgets((prev) => prev.map((b) => b.id === editingBudget.id ? { ...mappedBudget, usage: editingBudget.usage } : b));
        setIsDialogOpen(false);
        setEditingBudget(null);
        toast({ title: "예산이 수정되었습니다." });
        fetchBudgets(true);
        router.refresh();
      } else {
        setBudgets((prev) => [mappedBudget, ...prev]);
        setIsDialogOpen(false);
        setEditingBudget(null);
        const newId = apiBudget?.id;
        if (newId) {
          router.push(`/dashboard/budget/${newId}`);
        } else {
          toast({ title: "새 예산이 등록되었습니다." });
          await fetchBudgets();
        }
      }
    } catch (error) {
      console.error("[BudgetPage] Unexpected error:", error);
      setSubmitError("통신이 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("이 예산을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        toast({ title: "예산이 삭제되었습니다." });
      }
    } catch {
      toast({ title: "삭제 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
    }
  };

  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 부서 목록 (실제 데이터 기반)
  const uniqueDepts = Array.from(new Set(budgets.map((b) => b.targetDepartment).filter(Boolean))) as string[];

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">예산 운영</h1>
            <p className="text-sm text-slate-500 mt-1">예산별 사용 현황을 확인하고 구매 통제 기준을 관리합니다.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingBudget(null); setSubmitError(null); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingBudget(null)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                예산 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBudget ? "예산 수정" : "예산 추가"}</DialogTitle>
                <DialogDescription>
                  {editingBudget ? "예산 정보를 수정합니다." : "새 예산을 등록하고 경고 기준을 설정합니다."}
                </DialogDescription>
              </DialogHeader>
              <BudgetForm
                key={editingBudget?.id ?? "create"}
                budget={editingBudget}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onClearSubmitError={() => setSubmitError(null)}
                onSubmit={handleAddBudget}
                onCancel={() => { setIsDialogOpen(false); setEditingBudget(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* 요약 KPI (데이터 있을 때만) */}
        {!isFetching && budgets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-500 font-medium">전체 예산</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(summaryKPI.total)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-500 font-medium">총 집행액</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(summaryKPI.spent)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">사용률 {summaryKPI.rate}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-500 font-medium">잔여 예산</p>
              <p className={`text-lg font-bold mt-0.5 ${summaryKPI.remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatCurrency(summaryKPI.remaining)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-500 font-medium">주의/초과</p>
              <p className={`text-lg font-bold mt-0.5 ${summaryKPI.warningCount > 0 ? "text-orange-600" : "text-slate-900"}`}>
                {summaryKPI.warningCount}건
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">운영 중 {summaryKPI.activeCount}건</p>
            </div>
          </div>
        )}

        {/* 필터/검색 바 */}
        {!isFetching && budgets.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="예산명, 프로젝트, 부서 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm border-slate-200 bg-white"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs border-slate-200 bg-white">
                <Filter className="h-3 w-3 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uniqueDepts.length > 0 && (
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs border-slate-200 bg-white">
                  <SelectValue placeholder="부서" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">전체 부서</SelectItem>
                  {uniqueDepts.map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 예산 목록 */}
        {isFetching ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="shadow-sm border-slate-200 animate-pulse">
                <CardContent className="p-5 space-y-3">
                  <div className="h-5 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-56 rounded bg-slate-100" />
                  <div className="h-2 rounded bg-slate-100" />
                  <div className="h-8 w-full rounded bg-slate-50" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          /* 빈 상태: 운영 안내 */
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-6 w-6 text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-1">아직 등록된 예산이 없습니다</p>
              <p className="text-xs text-slate-500 mb-1 max-w-sm mx-auto leading-relaxed">
                예산을 등록하면 구매 내역과 자동으로 연동되어 사용률, 잔여 금액, 초과 위험을 실시간으로 확인할 수 있습니다.
              </p>
              <p className="text-xs text-slate-400 mb-5">
                구매 내역에서 예산을 연결하면 집행 금액이 자동 반영됩니다.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button size="sm" onClick={() => { setEditingBudget(null); setIsDialogOpen(true); }} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  첫 예산 등록하기
                </Button>
                <Link href="/dashboard/purchases">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    구매 내역 보기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : filteredBudgets.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="py-12 text-center">
              <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">검색 결과가 없습니다</p>
              <p className="text-xs text-slate-400">다른 키워드나 필터 조건을 변경해보세요.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredBudgets.map((budget) => {
              const budgetStatus = getBudgetStatus(budget);
              const statusConf = STATUS_CONFIG[budgetStatus];
              const StatusIcon = statusConf.icon;
              const used = budget.usage?.totalSpent ?? 0;
              const total = budget.amount;
              const rate = total > 0 ? Math.round((used / total) * 100) : 0;
              const remaining = budget.usage?.remaining ?? total;
              const startStr = budget.periodStart && new Date(budget.periodStart).toLocaleDateString("ko-KR");
              const endStr = budget.periodEnd && new Date(budget.periodEnd).toLocaleDateString("ko-KR");

              // 종료까지 남은 일수
              const daysLeft = Math.max(0, Math.ceil((new Date(budget.periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

              // 카드 테두리 색상
              const borderClass = budgetStatus === "exceeded"
                ? "border-red-200"
                : budgetStatus === "warning"
                ? "border-orange-200"
                : "border-slate-200";

              return (
                <Card key={budget.id} className={`shadow-sm ${borderClass} overflow-hidden`}>
                  <CardContent className="p-0">
                    {/* 카드 상단 */}
                    <div className="px-4 md:px-5 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-slate-900 truncate">{budget.name}</h3>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${statusConf.color}`}>
                              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                              {statusConf.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{startStr} ~ {endStr}</span>
                            {budgetStatus !== "ended" && budgetStatus !== "upcoming" && (
                              <span>({daysLeft}일 남음)</span>
                            )}
                          </div>
                          {(budget.targetDepartment || budget.projectName) && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {budget.targetDepartment && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{budget.targetDepartment}</span>
                              )}
                              {budget.projectName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{budget.projectName}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 사용률 바 */}
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-xs text-slate-500">사용률</span>
                          <span className={`text-xs font-bold ${rate > 100 ? "text-red-600" : rate >= 80 ? "text-orange-600" : "text-slate-900"}`}>
                            {rate}%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(rate, 100)}
                          className={`h-1.5 ${rate > 100 ? "[&>div]:bg-red-500" : rate >= 80 ? "[&>div]:bg-orange-500" : ""}`}
                        />
                      </div>

                      {/* 금액 정보 */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div>
                          <p className="text-[10px] text-slate-400">예산</p>
                          <p className="text-xs font-semibold text-slate-800">{formatCurrency(total, budget.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">집행</p>
                          <p className="text-xs font-semibold text-slate-800">{formatCurrency(used, budget.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">잔여</p>
                          <p className={`text-xs font-semibold ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {formatCurrency(remaining, budget.currency)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 카드 하단 액션 */}
                    <div className="flex items-center border-t border-slate-100 divide-x divide-slate-100">
                      <Link href={`/dashboard/budget/${budget.id}`} className="flex-1">
                        <button className="w-full flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-blue-600 font-medium hover:bg-blue-50/50 transition-colors">
                          상세 보기
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </Link>
                      <button
                        onClick={() => { setEditingBudget(budget); setIsDialogOpen(true); }}
                        className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Edit className="h-3 w-3" />
                        수정
                      </button>
                      <Link href={`/dashboard/purchases`} className="hidden sm:block">
                        <button className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                          <ShoppingCart className="h-3 w-3" />
                          구매
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50/50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────
   예산 추가/수정 폼
   ────────────────────────────────────── */

function BudgetForm({
  budget,
  isSubmitting = false,
  submitError,
  onClearSubmitError,
  onSubmit,
  onCancel,
}: {
  budget?: Budget | null;
  isSubmitting?: boolean;
  submitError?: string | null;
  onClearSubmitError?: () => void;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();

  const getDefaultStartDate = (): Date => {
    if (budget?.periodStart) return new Date(budget.periodStart);
    return new Date();
  };
  const getDefaultEndDate = (): Date => {
    if (budget?.periodEnd) return new Date(budget.periodEnd);
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31);
  };

  const [name, setName] = useState(budget?.name || "");
  const [amount, setAmount] = useState(budget?.amount?.toString() || "");
  const [currency, setCurrency] = useState(budget?.currency || "KRW");
  const [periodStart, setPeriodStart] = useState<Date | null>(getDefaultStartDate());
  const [periodEnd, setPeriodEnd] = useState<Date | null>(getDefaultEndDate());
  const [targetDepartment, setTargetDepartment] = useState(budget?.targetDepartment || "");
  const [projectName, setProjectName] = useState(budget?.projectName || "");
  const [description, setDescription] = useState(budget?.description || "");
  const [warningThreshold, setWarningThreshold] = useState("80");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatAmount = (value: string) => {
    const numValue = value.replace(/,/g, "");
    if (!numValue) return "";
    const num = parseFloat(numValue);
    if (isNaN(num)) return value;
    return num.toLocaleString("ko-KR");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "");
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
    }
  };

  const handlePeriodStartChange = (date: Date | undefined) => {
    if (!date) { setPeriodStart(null); return; }
    setPeriodStart(date);
    if (periodEnd && date > periodEnd) {
      setErrors((prev) => ({ ...prev, periodStart: "시작일은 종료일보다 이전이어야 합니다." }));
    } else {
      setErrors((prev) => ({ ...prev, periodStart: "" }));
    }
  };

  const handlePeriodEndChange = (date: Date | undefined) => {
    if (!date) { setPeriodEnd(null); return; }
    setPeriodEnd(date);
    if (periodStart && date < periodStart) {
      setErrors((prev) => ({ ...prev, periodEnd: "종료일은 시작일보다 이후여야 합니다." }));
    } else {
      setErrors((prev) => ({ ...prev, periodEnd: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "예산 이름을 입력해주세요.";
    const amountNum = parseFloat(amount.replace(/,/g, ""));
    if (!amount || isNaN(amountNum) || amountNum <= 0) newErrors.amount = "올바른 예산 금액을 입력해주세요.";
    if (!periodStart) newErrors.periodStart = "시작일을 선택해주세요.";
    if (!periodEnd) newErrors.periodEnd = "종료일을 선택해주세요.";
    if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) newErrors.periodEnd = "종료일은 시작일보다 이후여야 합니다.";
    if (!targetDepartment.trim()) newErrors.targetDepartment = "대상 부서/팀을 선택해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearSubmitError?.();
    if (!validate()) {
      toast({ title: "입력 오류", description: "입력한 정보를 확인해주세요.", variant: "destructive" });
      return;
    }
    const cleanAmount = Number(String(amount).replace(/[^0-9]/g, ""));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast({ title: "입력 오류", description: "올바른 예산 금액을 입력해주세요.", variant: "destructive" });
      return;
    }
    onSubmit({
      name: name.trim(),
      amount: cleanAmount,
      currency,
      periodStart: periodStart ? periodStart.toISOString().split("T")[0] : "",
      periodEnd: periodEnd ? periodEnd.toISOString().split("T")[0] : "",
      targetDepartment: targetDepartment.trim() || undefined,
      projectName: projectName.trim() || undefined,
      description: description.trim() || undefined,
      warningThreshold: parseInt(warningThreshold) || 80,
    });
  };

  // 기간 일수 계산
  const periodDays = periodStart && periodEnd
    ? Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 예산 이름 */}
      <div>
        <Label htmlFor="name">예산 이름 *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }}
          placeholder="예: 2026년 상반기 시약 구매 예산"
          required
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* 금액 + 통화 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">예산 금액 *</Label>
          <div className="relative">
            <Input
              id="amount"
              type="text"
              value={formatAmount(amount)}
              onChange={handleAmountChange}
              placeholder="예: 10,000,000"
              required
              className={errors.amount ? "border-red-500" : ""}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
          </div>
          {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
        </div>
        <div>
          <Label htmlFor="currency">통화 *</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="KRW">KRW (원)</SelectItem>
              <SelectItem value="USD">USD (달러)</SelectItem>
              <SelectItem value="EUR">EUR (유로)</SelectItem>
              <SelectItem value="JPY">JPY (엔)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 기간 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>기간 시작 *</Label>
          <DatePicker
            date={periodStart || undefined}
            onDateChange={handlePeriodStartChange}
            placeholder="시작일 선택"
            maxDate={periodEnd || undefined}
            className={errors.periodStart ? "border-red-500" : ""}
          />
          {errors.periodStart && <p className="text-xs text-red-500 mt-1">{errors.periodStart}</p>}
        </div>
        <div>
          <Label>기간 종료 *</Label>
          <DatePicker
            date={periodEnd || undefined}
            onDateChange={handlePeriodEndChange}
            placeholder="종료일 선택"
            minDate={periodStart || undefined}
            className={errors.periodEnd ? "border-red-500" : ""}
          />
          {errors.periodEnd && <p className="text-xs text-red-500 mt-1">{errors.periodEnd}</p>}
        </div>
      </div>

      {periodStart && periodEnd && periodDays > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          {periodStart.toLocaleDateString("ko-KR")} ~ {periodEnd.toLocaleDateString("ko-KR")} ({periodDays}일)
        </div>
      )}

      {/* 적용 범위 */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-700">적용 범위</Label>
        <p className="text-[11px] text-slate-400 mb-2">이 예산이 적용되는 부서와 프로젝트를 지정합니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="targetDepartment" className="text-xs">
              대상 부서/팀 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={targetDepartment}
              onValueChange={(v) => { setTargetDepartment(v); if (errors.targetDepartment) setErrors((prev) => ({ ...prev, targetDepartment: "" })); }}
            >
              <SelectTrigger className={errors.targetDepartment ? "border-red-500" : ""}>
                <SelectValue placeholder="부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.targetDepartment && <p className="text-xs text-red-500 mt-1">{errors.targetDepartment}</p>}
          </div>
          <div>
            <Label htmlFor="projectName" className="text-xs">프로젝트/과제명</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="예: 신약 개발 프로젝트"
            />
          </div>
        </div>
      </div>

      {/* 경고 기준 */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-700">경고 기준</Label>
        <p className="text-[11px] text-slate-400 mb-2">사용률이 기준에 도달하면 대시보드에 경고가 표시됩니다.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              <span className="text-[11px] font-medium text-orange-700">주의 알림</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="50"
                max="99"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                className="h-7 w-16 text-xs text-center px-1"
              />
              <span className="text-xs text-slate-500">% 도달 시</span>
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-[11px] font-medium text-red-700">초과 경고</span>
            </div>
            <p className="text-xs text-slate-500">100% 초과 시 자동 표시</p>
          </div>
        </div>
      </div>

      {/* 운영 메모 */}
      <div>
        <Label htmlFor="description">운영 메모</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 상반기 시약 구매 한도. 초과 시 팀장 승인 필요."
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-slate-400 mt-1">예산 운영 시 참고할 내부 메모를 남길 수 있습니다.</p>
      </div>

      {/* 제출 */}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
          취소
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{budget ? "수정 중..." : "저장 중..."}</>
          ) : (
            submitError ? "다시 시도" : budget ? "예산 수정" : "예산 등록"
          )}
        </Button>
      </div>
      {submitError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-600">{submitError}</p>
        </div>
      )}
    </form>
  );
}
