"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Calendar, Loader2, Search, ChevronRight, ArrowUpRight,
  ShieldAlert, Sparkles, AlertTriangle, CheckCircle2, Clock,
  Beaker, RefreshCw, FileText, Download, TrendingUp, Info,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CategorySpendingWidget from "@/components/dashboard/CategorySpendingWidget";
import {
  useBudgetStore,
  deriveBudgetControl,
  generateMonthlyData,
  aggregateDepartments,
  type Budget,
  type BudgetControl,
  type BudgetWithControl,
  type DepartmentSpending,
} from "@/lib/store/budget-store";

// ── Risk config ──
const RISK_CONFIG: Record<string, { label: string; color: string; dotColor: string; barColor: string }> = {
  safe:     { label: "정상", color: "text-emerald-600", dotColor: "bg-emerald-500", barColor: "bg-emerald-500" },
  warning:  { label: "주의", color: "text-amber-600",   dotColor: "bg-amber-500",   barColor: "bg-amber-500" },
  critical: { label: "소과", color: "text-orange-600",  dotColor: "bg-orange-500",  barColor: "bg-orange-500" },
  over:     { label: "초과", color: "text-red-600",     dotColor: "bg-red-500",     barColor: "bg-red-500" },
  ended:    { label: "종료", color: "text-slate-500",   dotColor: "bg-slate-400",   barColor: "bg-slate-400" },
  upcoming: { label: "예정", color: "text-blue-600",    dotColor: "bg-blue-500",    barColor: "bg-blue-500" },
};

const BUDGET_DEPARTMENT_OPTIONS = [
  { value: "연구 본부", label: "연구 본부" },
  { value: "공통 관리팀", label: "공통 관리팀" },
  { value: "바이오 산학협", label: "바이오 산학협" },
  { value: "공정개발팀", label: "공정개발팀" },
  { value: "기초연구팀", label: "기초연구팀" },
  { value: "품질관리(QC)팀", label: "품질관리(QC)팀" },
  { value: "전체(공용 예산)", label: "전체(공용 예산)" },
];

/** 한국 원화 표기: ₩12,000,000원 */
function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}원`;
}

/** 짧은 원화 표기 (KPI 등) */
function formatWonShort(n: number): string {
  if (n === 0) return "0원";
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만원`;
  return `₩${n.toLocaleString("ko-KR")}원`;
}

// ── Chart custom tooltip ──
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.dataKey === "actual" ? "실제 지출" : "예산 한도"}</span>
          <span className="font-medium text-slate-700 ml-auto tabular-nums">
            {formatWonShort(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BudgetPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const { organizationId: activeOrgId } = usePermission();

  // Zustand store
  const { budgets, isFetching, searchQuery, setBudgets, setIsFetching, setSearchQuery } = useBudgetStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Fetch budgets ──
  const fetchBudgets = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsFetching(true);
      const res = await fetch("/api/budgets");
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json.budgets) ? json.budgets : [];
      setBudgets(list);
    } catch (e) {
      console.error("[BudgetPage] Failed to fetch budgets:", e);
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, [setBudgets, setIsFetching]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // ── Derived state ──
  const controls: BudgetWithControl[] = useMemo(
    () => budgets.map((b: Budget) => ({ budget: b, ctrl: deriveBudgetControl(b) })),
    [budgets],
  );

  const filteredControls = useMemo(() => {
    if (!searchQuery.trim()) return controls;
    const q = searchQuery.toLowerCase();
    return controls.filter(
      (c: BudgetWithControl) =>
        c.budget.name.toLowerCase().includes(q) ||
        c.budget.targetDepartment?.toLowerCase().includes(q) ||
        c.budget.projectName?.toLowerCase().includes(q),
    );
  }, [controls, searchQuery]);

  const actionKpi = useMemo(() => {
    const immediateReview = controls.filter((c: BudgetWithControl) => c.ctrl.risk === "over").length;
    const blockRisk = controls.filter(
      (c: BudgetWithControl) => c.ctrl.risk === "warning" || c.ctrl.risk === "critical",
    ).length;
    const pendingApproval = controls.filter(
      (c: BudgetWithControl) => c.ctrl.reserved > 0 && (c.ctrl.risk === "warning" || c.ctrl.risk === "critical"),
    ).length;
    const altSavings = controls.reduce((sum: number, c: BudgetWithControl) => {
      if (c.ctrl.risk === "warning" || c.ctrl.risk === "critical" || c.ctrl.risk === "over") {
        return sum + Math.round(c.ctrl.actual * 0.15);
      }
      return sum;
    }, 0);
    const weeklyBurn = controls.reduce((s: number, c: BudgetWithControl) => s + c.ctrl.actual, 0) > 0
      ? Math.round(controls.reduce((s: number, c: BudgetWithControl) => s + c.ctrl.actual, 0) / 4)
      : 0;
    return { immediateReview, blockRisk, pendingApproval, altSavings, weeklyBurn };
  }, [controls]);

  // ── Chart data ──
  const monthlyData = useMemo(() => generateMonthlyData(budgets), [budgets]);
  const departmentTop3 = useMemo(() => aggregateDepartments(budgets), [budgets]);

  // ── AI Insight mock ──
  const aiInsights = useMemo(() => {
    const insights: { icon: string; title: string; description: string; actionLabel: string; actionHref: string; color: string }[] = [];
    const overBudgets = controls.filter((c: BudgetWithControl) => c.ctrl.risk === "over" || c.ctrl.risk === "critical");
    if (overBudgets.length > 0) {
      const b = overBudgets[0].budget;
      insights.push({
        icon: "⚠️",
        title: "이상 지출 감지",
        description: `"${b.name}"의 소모품 지출이 지난 3개월 평균 대비 42% 급증했습니다. 대량 발주 여부를 확인하세요.`,
        actionLabel: "상세 분석 보기",
        actionHref: `/dashboard/budget/${b.id}`,
        color: "text-amber-600",
      });
    }
    insights.push({
      icon: "📉",
      title: "절감 기회 포착",
      description: "현재 진행 중인 5개 프로젝트의 공통 시약(PBS, Ethanol)을 통합 발주할 경우, 연간 약 ₩1.2M의 절감이 가능합니다.",
      actionLabel: "통합 발주 제안서 확인",
      actionHref: "/dashboard/purchases",
      color: "text-emerald-600",
    });
    insights.push({
      icon: "📊",
      title: "소진 시점 예측",
      description: `현재 소진 속도 유지 시, 상반기 예산은 약 2주차에 조기 소진될 것으로 예측됩니다.`,
      actionLabel: "예산 재배정 시뮬레이션",
      actionHref: "/dashboard/budget",
      color: "text-red-600",
    });
    return insights;
  }, [controls]);

  // ── Budget CRUD ──
  const handleAddBudget = async (formData: {
    name: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    targetDepartment?: string | null;
    projectName?: string | null;
    description?: string | null;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const cleanAmount = typeof formData.amount === "string"
        ? Number(String(formData.amount).replace(/[^0-9]/g, ""))
        : formData.amount;

      const isEdit = !!editingBudget;
      const url = isEdit ? `/api/budgets/${editingBudget!.id}` : "/api/budgets";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name: formData.name, amount: cleanAmount, currency: formData.currency, periodStart: formData.periodStart, periodEnd: formData.periodEnd, projectName: formData.projectName ?? null, description: formData.description ?? null }
        : { name: formData.name, amount: cleanAmount, currency: formData.currency, periodStart: formData.periodStart, periodEnd: formData.periodEnd, projectName: formData.projectName, description: formData.description, targetDepartment: formData.targetDepartment, organizationId: activeOrgId };

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError((json as any)?.error || "예산 반영 중 오류가 발생했습니다.");
        return;
      }

      setIsDialogOpen(false);
      setEditingBudget(null);
      if (isEdit) {
        toast({ title: "예산이 수정되었습니다." });
      } else {
        const newId = (json as any)?.budget?.id;
        if (newId) {
          router.push(`/dashboard/budget/${newId}`);
          return;
        }
        toast({ title: "새 예산이 등록되었습니다." });
      }
      await fetchBudgets();
    } catch {
      setSubmitError("통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading state ──
  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-12">
        <div className="max-w-7xl mx-auto text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ Header ═══ */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-slate-600">대시보드</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700 font-medium">예산 관리</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900">예산 통제 워크벤치</h1>
                <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-medium hover:bg-violet-100 transition-colors">
                  <Sparkles className="h-3 w-3" />
                  AI 분석 생성
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                이번 달 발주 가능 예산을 확인하고, 지출 일정을 관리하세요.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                보고서 내보내기
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open: boolean) => { setIsDialogOpen(open); if (!open) { setEditingBudget(null); setSubmitError(null); } }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingBudget(null)} size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />예산 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingBudget ? "예산 수정" : "예산안 만들기"}</DialogTitle>
                    <DialogDescription>팀/프로젝트 예산을 생성하고 승인 후 활성화할 수 있습니다.</DialogDescription>
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* ═══ KPI Strip ═══ */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide sm:grid sm:grid-cols-3 md:grid-cols-5 sm:gap-3 sm:overflow-visible sm:pb-0">
          {[
            {
              icon: <AlertTriangle className="h-4 w-4" />,
              iconColor: actionKpi.immediateReview > 0 ? "text-red-500 bg-red-50" : "text-slate-400 bg-slate-100",
              label: "즉시 확인",
              value: `${actionKpi.immediateReview}건`,
              sub: actionKpi.immediateReview > 0 ? "초과 항목 검토 필요" : "초과 항목 없음",
            },
            {
              icon: <Clock className="h-4 w-4" />,
              iconColor: actionKpi.blockRisk > 0 ? "text-amber-500 bg-amber-50" : "text-slate-400 bg-slate-100",
              label: "차단 위험",
              value: `${actionKpi.blockRisk}건`,
              sub: actionKpi.blockRisk > 0 ? "임계 구간 — 곧 차단 가능" : "임계치 안전",
            },
            {
              icon: <CheckCircle2 className="h-4 w-4" />,
              iconColor: actionKpi.pendingApproval > 0 ? "text-blue-500 bg-blue-50" : "text-slate-400 bg-slate-100",
              label: "승인 대기",
              value: `${actionKpi.pendingApproval}건`,
              sub: "임계 구간 내 예약 건",
            },
            {
              icon: <TrendingUp className="h-4 w-4" />,
              iconColor: actionKpi.altSavings > 0 ? "text-emerald-500 bg-emerald-50" : "text-slate-400 bg-slate-100",
              label: "절감 가능",
              value: formatWonShort(actionKpi.altSavings),
              sub: actionKpi.altSavings > 0 ? "절감 대상 감지" : "절감 대상 없음",
            },
            {
              icon: <RefreshCw className="h-4 w-4" />,
              iconColor: "text-slate-400 bg-slate-100",
              label: "주간 소진",
              value: formatWonShort(actionKpi.weeklyBurn),
              sub: "최근 4주 평균 기준",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="min-w-[140px] snap-start shrink-0 sm:min-w-0 sm:shrink bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.iconColor}`}>
                  {kpi.icon}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mb-0.5">{kpi.label}</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{kpi.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ═══ 카테고리별 예산 사용 현황 ═══ */}
        {activeOrgId && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <CategorySpendingWidget organizationId={activeOrgId} />
          </div>
        )}

        {/* ═══ Chart + Department TOP 3 ═══ */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 월별 지출 추이 */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">월별 지출 추이 (AI 예측 포함)</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">최근 6개월간의 실적 지출량과 예산 한도를 비교합니다.</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> 실제 지출</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> 예산 한도</span>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1_000_000 ? `₩${(v / 1_000_000).toFixed(0)}M` : `₩${(v / 1_000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="budget" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} fill="url(#colorActual)" dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 부서별 예산 소진 TOP 3 + AI Insight */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">부서별 예산 소진 TOP 3</h2>
                {departmentTop3.length > 0 ? (
                  <div className="space-y-3">
                    {departmentTop3.map((dept: DepartmentSpending) => {
                      const barColor = dept.rate > 100 ? "bg-red-500" : dept.rate >= 80 ? "bg-amber-500" : "bg-emerald-500";
                      return (
                        <div key={dept.department}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-700 font-medium">{dept.department}</span>
                            <span className={`text-xs font-bold tabular-nums ${dept.rate > 100 ? "text-red-600" : dept.rate >= 80 ? "text-amber-600" : "text-emerald-600"}`}>{dept.rate}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(dept.rate, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">예산 데이터가 부족합니다.</p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h3 className="text-xs font-semibold text-slate-700">AI 인사이트</h3>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  총합 판단한 소진 속도가 이례적으로 빠릅니다. 견적 비교 시 대체 시약을 함께 확인하세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Search Bar ═══ */}
        {budgets.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="예산명, 부서, 프로젝트로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <Link href="/dashboard/purchases">
              <span className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 whitespace-nowrap">
                미매핑 요청 보기 <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        )}

        {/* ═══ Budget Table ═══ */}
        {isFetching ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg border border-slate-200 animate-pulse bg-white" />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState onCreateClick={() => { setEditingBudget(null); setIsDialogOpen(true); }} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1fr_120px_110px_80px_60px_100px_40px] gap-2 px-5 py-3 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-medium bg-slate-50/60">
              <span>예산 · 프로젝트/실험</span>
              <span className="text-right">현재 비용</span>
              <span className="text-right">가용 잔액</span>
              <span className="text-center">소진율</span>
              <span className="text-center">상태</span>
              <span className="text-center">다음 행동</span>
              <span />
            </div>
            {/* Rows */}
            {filteredControls.map(({ budget: b, ctrl }: BudgetWithControl) => {
              const riskCfg = RISK_CONFIG[ctrl.risk];
              const nextAction =
                ctrl.risk === "over" ? "지출 차단 체제 필요"
                : ctrl.risk === "critical" ? "예산 증액 검토"
                : ctrl.risk === "warning" ? "추이 확인"
                : "상세 보기";
              const barColor = ctrl.risk === "over" ? "bg-red-500"
                : ctrl.risk === "critical" ? "bg-orange-500"
                : ctrl.risk === "warning" ? "bg-amber-400"
                : "bg-emerald-500";
              return (
                <Link key={b.id} href={`/dashboard/budget/${b.id}`} className="block border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[1fr_120px_110px_80px_60px_100px_40px] gap-2 items-center px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${riskCfg.dotColor}`} />
                        <span className="text-sm font-medium text-slate-800 truncate">{b.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 ml-4">
                        {b.targetDepartment || "부서 미지정"}
                        {b.projectName && <> · <span className="text-slate-400">{b.projectName}</span></>}
                        {" · "}
                        {new Date(b.periodStart).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        {" ~ "}
                        {new Date(b.periodEnd).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatWon(ctrl.actual)}</p>
                      <p className="text-[10px] text-slate-400">/ {formatWon(ctrl.total)}</p>
                    </div>
                    <div className="text-sm text-slate-800 text-right tabular-nums font-medium">{formatWon(ctrl.available)}</div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-10 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(ctrl.burnRate, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums">{Math.round(ctrl.burnRate)}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`text-[11px] font-semibold ${riskCfg.color}`}>{riskCfg.label}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] text-blue-600 font-medium">{nextAction}</span>
                    </div>
                    <div className="flex justify-end">
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden px-4 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${riskCfg.dotColor}`} />
                        <span className="text-sm font-medium text-slate-800 truncate">{b.name}</span>
                      </div>
                      <span className={`text-[11px] font-semibold shrink-0 ${riskCfg.color}`}>{riskCfg.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2 ml-4">
                      {b.targetDepartment || "부서 미지정"}{b.projectName && ` · ${b.projectName}`}
                    </div>
                    <div className="flex items-center justify-between ml-4 text-[11px]">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">비용 <span className="text-slate-700 font-medium tabular-nums">{formatWon(ctrl.actual)}</span></span>
                        <span className="text-slate-400">가용 <span className="text-slate-700 font-medium tabular-nums">{formatWon(ctrl.available)}</span></span>
                      </div>
                      <span className="text-blue-600 font-medium">{nextAction}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {filteredControls.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-slate-400">검색 조건에 맞는 예산이 없습니다</div>
            )}
          </div>
        )}

        {/* ═══ Bottom Summary Strip ═══ */}
        {!isFetching && budgets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "미매핑 요청", count: 0, sub: "예산 미연결 요청 확인", href: "/dashboard/purchases" },
              { label: "초과 위험 감지", count: actionKpi.blockRisk + actionKpi.immediateReview, sub: "임계 구간 · 초과 건 검토", href: "/dashboard/budget" },
              { label: "승인 대기", count: actionKpi.pendingApproval, sub: "예산 초과분 승인 요청", href: "/dashboard/purchases" },
              { label: "발주 전환 대기", count: controls.filter((c: BudgetWithControl) => c.ctrl.risk === "safe").length, sub: "예산 확인 완료 건", href: "/dashboard/quotes" },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="block">
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{item.count}건</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ═══ AI 예산 이상 탐지 & 예측 ═══ */}
        {!isFetching && budgets.length > 0 && (
          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold">AI 예산 이상 탐지 &amp; 예측</h2>
                <p className="text-[11px] text-white/60">과거 지출 패턴을 분석하여 미래 예산 부족 위험을 사전에 경고합니다.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiInsights.map((insight, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{insight.icon}</span>
                    <h3 className="text-xs font-semibold text-white">{insight.title}</h3>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed mb-3">{insight.description}</p>
                  <Link href={insight.actionHref} className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium">
                    {insight.actionLabel} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-4" />
        <p className="text-base font-semibold text-slate-700 mb-1.5">예산이 아직 등록되지 않았습니다</p>
        <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed mb-6">
          예산을 등록하면 요청·견적·발주 흐름에서 예산 초과 여부를 사전에 확인하고,
          임계치에 도달하면 자동으로 경고합니다.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onCreateClick}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />첫 예산 풀 만들기
          </Button>
          <Link href="/dashboard/purchases">
            <Button size="sm" variant="outline">구매 요청과 예산 연결</Button>
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">예산 등록 후 가능한 통제</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-xs">
            <span className="font-medium text-slate-700">요청 차단</span>
            <span className="block mt-0.5 text-[11px] text-slate-400">예산 잔액 부족 시 요청 단계에서 자동 차단</span>
          </div>
          <div className="text-xs">
            <span className="font-medium text-slate-700">AI 대체 제안</span>
            <span className="block mt-0.5 text-[11px] text-slate-400">초과 위험 시 대체 시약·절감 옵션 자동 분석</span>
          </div>
          <div className="text-xs">
            <span className="font-medium text-slate-700">승인 라우팅</span>
            <span className="block mt-0.5 text-[11px] text-slate-400">임계치 도달 시 예외 승인 경로로 자동 분기</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Budget Form
// ═══════════════════════════════════════════════════════════════════
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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">예산 이름 *</Label>
        <Input id="name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }} placeholder="예: 2026 상반기 시약비" required className={errors.name ? "border-red-500" : ""} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">예산 금액 *</Label>
          <div className="relative">
            <Input id="amount" type="text" value={formatAmount(amount)} onChange={handleAmountChange} placeholder="예: 10,000,000" required className={errors.amount ? "border-red-500" : ""} />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="periodStart">기간 시작 *</Label>
          <DatePicker date={periodStart || undefined} onDateChange={(d: Date | undefined) => setPeriodStart(d || null)} placeholder="날짜를 선택하세요" maxDate={periodEnd || undefined} className={errors.periodStart ? "border-red-500" : ""} />
          {errors.periodStart && <p className="text-xs text-red-500 mt-1">{errors.periodStart}</p>}
        </div>
        <div>
          <Label htmlFor="periodEnd">기간 종료 *</Label>
          <DatePicker date={periodEnd || undefined} onDateChange={(d: Date | undefined) => setPeriodEnd(d || null)} placeholder="날짜를 선택하세요" minDate={periodStart || undefined} className={errors.periodEnd ? "border-red-500" : ""} />
          {errors.periodEnd && <p className="text-xs text-red-500 mt-1">{errors.periodEnd}</p>}
        </div>
      </div>
      {periodStart && periodEnd && (
        <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <Calendar className="h-3 w-3 inline mr-1" />
          예산 기간: {periodStart.toLocaleDateString("ko-KR")} ~ {periodEnd.toLocaleDateString("ko-KR")} ({Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))}일)
        </div>
      )}
      <div>
        <Label htmlFor="targetDepartment">대상 부서/팀 <span className="text-red-500">*</span></Label>
        <Select value={targetDepartment} onValueChange={(v: string) => { setTargetDepartment(v); if (errors.targetDepartment) setErrors((prev) => ({ ...prev, targetDepartment: "" })); }}>
          <SelectTrigger className={errors.targetDepartment ? "border-red-500" : ""}><SelectValue placeholder="부서를 선택해주세요" /></SelectTrigger>
          <SelectContent>
            {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.targetDepartment && <p className="text-xs text-red-500 mt-1">{errors.targetDepartment}</p>}
      </div>
      <div>
        <Label htmlFor="projectName">프로젝트/과제명 (선택)</Label>
        <Input id="projectName" value={projectName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)} placeholder="예: 신약 개발 프로젝트" />
      </div>
      <div>
        <Label htmlFor="description">설명 (선택)</Label>
        <Textarea id="description" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder="예산에 대한 추가 설명" rows={3} className="resize-none" />
      </div>
      {submitError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-600">{submitError}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>취소</Button>
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{budget ? "수정 중..." : "저장 중..."}</>) : (budget ? "예산 수정 저장" : "예산안 저장")}
        </Button>
      </div>
    </form>
  );
}
