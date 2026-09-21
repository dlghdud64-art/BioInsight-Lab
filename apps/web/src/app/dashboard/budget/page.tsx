"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import { csrfFetch } from "@/lib/api-client";
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
  type Budget,
  type BudgetControl,
  type BudgetWithControl,
} from "@/lib/store/budget-store";

// ── Risk config ──
const RISK_CONFIG: Record<string, { label: string; color: string; dotColor: string; barColor: string }> = {
  safe:     { label: "정상", color: "text-emerald-600", dotColor: "bg-emerald-500", barColor: "bg-emerald-500" },
  warning:  { label: "주의", color: "text-yellow-600",   dotColor: "bg-yellow-500",   barColor: "bg-yellow-500" },
  critical: { label: "소과", color: "text-red-600",  dotColor: "bg-red-500",  barColor: "bg-red-500" },
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

// §mobile-budgets 7b — 진입점 3곳 공용 등록 시트 + 등록 즉시 양 화면 동기화(analytics invalidate)
import { BudgetRegisterSheet } from "@/components/budget/budget-register-sheet";
import { useQueryClient } from "@tanstack/react-query";

export default function BudgetPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const { organizationId: activeOrgId } = usePermission();
  const queryClient = useQueryClient();

  // §mobile-budgets 7a/7b — 모바일 시트·요약 상세·온보딩 배너 상태
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [kpiDetailOpen, setKpiDetailOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
        c.budget.projectName?.toLowerCase().includes(q),
    );
  }, [controls, searchQuery]);

  /* 🛑 §budget-fabricated-figures (2026-09-20 · 릴레이 판정) — 근거 없는 파생 지표 3종을 지웠다.
   *   승인 대기  deriveBudgetControl 의 reserved 가 **상수 0**이라 조건이 성립한 적이 없다(항상 0건).
   *              실제 예약은 BudgetEvent(ORDER_RESERVED)에 있는데 이 화면은 읽지 않는다.
   *              예약 흐름을 실측한 뒤에 되살린다.
   *   절감 가능  위험 예산 지출 × 0.15 — 15% 는 근거 없는 고정 비율이었다.
   *   주간 소진  총 지출 ÷ 4 — 기간도 주 수도 보지 않았다("최근 4주 평균 기준" 은 사실이 아니었다).
   *              prod 실측(2026-09-20): 구매 1건(8/18)뿐이라 어떤 산식도 의미 있는 주 평균을 못 낸다.
   *   남긴 둘(즉시 확인·차단 위험)은 소진율 임계값 계산이라 실데이터다.
   *   계약: __tests__/regression/budget-fabricated-figures.test.ts */
  const actionKpi = useMemo(() => {
    const immediateReview = controls.filter((c: BudgetWithControl) => c.ctrl.risk === "over").length;
    const blockRisk = controls.filter(
      (c: BudgetWithControl) => c.ctrl.risk === "warning" || c.ctrl.risk === "critical",
    ).length;
    return { immediateReview, blockRisk };
  }, [controls]);

  // ── Budget CRUD ──
  const handleAddBudget = async (formData: {
    name: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
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
        : { name: formData.name, amount: cleanAmount, currency: formData.currency, periodStart: formData.periodStart, periodEnd: formData.periodEnd, projectName: formData.projectName, description: formData.description, organizationId: activeOrgId };

      const res = await csrfFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    <div className="min-h-screen bg-canvas">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* ═══ Header ═══ */}
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Link href="/dashboard" className="hover:text-slate-600">대시보드</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900">예산 관리</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 mb-1">예산 관리</h1>
              <p className="text-sm text-slate-500">
                {/* §mobile-budgets §1 — 모바일 한 줄 압축, 데스크톱 원문 보존 */}
                <span className="md:hidden">등록 · 집행 · 승인 대기 · 초과 위험을 한곳에서</span>
                <span className="hidden md:inline">예산 등록, 집행 현황, 승인 대기와 초과 위험을 관리합니다.</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200" aria-label="보고서 내보내기">
                <Download className="h-3.5 w-3.5 md:mr-1.5" />
                <span className="hidden md:inline">보고서 내보내기</span>
              </Button>
              {/* §mobile-budgets 7b 진입점 ① — 모바일은 시트, 데스크톱은 기존 Dialog 보존 */}
              <Button onClick={() => setIsSheetOpen(true)} size="sm" className="md:hidden h-8 text-xs bg-blue-600 hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5 mr-1.5" />예산 등록
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open: boolean) => { setIsDialogOpen(open); if (!open) { setEditingBudget(null); setSubmitError(null); } }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingBudget(null)} size="sm" className="hidden md:inline-flex h-8 text-xs bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />예산 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
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

        {/* §mobile-budgets §1 — 온보딩 배너(중형): 예산 0개 · 모바일 전용 · 잘림 금지(break-keep) */}
        {budgets.length === 0 && !isFetching && !bannerDismissed && (
          <div className="md:hidden rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#16233f,#1d3157)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#93c5fd" }}>예산 통제 시작하기 · 2분</p>
            <h3 className="text-[15px] font-extrabold mt-1 break-keep">첫 분기 예산을 설정하면 초과 위험을 자동으로 감시합니다</h3>
            <p className="text-[12px] text-slate-300 mt-1 break-keep">발주 완료 건이 자동 집계되어 소진율·경고가 실계산됩니다</p>
            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={() => setIsSheetOpen(true)} className="h-11 min-h-[44px] px-4 rounded-xl bg-[#2563eb] text-white text-[13px] font-bold active:bg-blue-700">
                첫 분기 예산 설정 ›
              </button>
              <button type="button" onClick={() => setBannerDismissed(true)} className="h-11 min-h-[44px] px-3 text-[13px] font-semibold text-slate-300">
                나중에
              </button>
            </div>
          </div>
        )}

        {/* §mobile-budgets §1 — 0건 = 초록 한 줄 요약 · 1건+ = 해당 항목만 카드 승격(배경 채색 금지, 숫자·라벨만 레드) */}
        <div className="md:hidden space-y-2">
          {actionKpi.immediateReview === 0 && actionKpi.blockRisk === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#e6eaf0] bg-green-50 px-3.5">
              <CheckCircle2 className="h-4 w-4 flex-none" style={{ color: "#15803d" }} />
              <p className="flex-1 text-[13px] font-semibold py-3" style={{ color: "#15803d" }}>예산 상태 정상 · 0/0</p>
              <button type="button" onClick={() => setKpiDetailOpen((v) => !v)} className="min-h-[44px] text-[12px] font-semibold text-slate-500">상세 ›</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "즉시 확인", count: actionKpi.immediateReview, sub: "초과 항목 검토 필요" },
                { label: "차단 위험", count: actionKpi.blockRisk, sub: "임계 구간 · 곧 차단 가능" },
              ].filter((k) => k.count > 0).map((k) => (
                <div key={k.label} className="bg-white rounded-xl border border-[#e6eaf0] px-3.5 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold" style={{ color: "#b91c1c" }}>{k.label}</p>
                    <p className="text-[11px] text-slate-400">{k.sub}</p>
                  </div>
                  <p className="text-[20px] font-extrabold tabular-nums" style={{ color: "#b91c1c" }}>{k.count}건</p>
                </div>
              ))}
              <button type="button" onClick={() => setKpiDetailOpen((v) => !v)} className="min-h-[44px] text-left text-[12px] font-semibold text-slate-500">상세 ›</button>
            </div>
          )}
          {kpiDetailOpen && (
            <div className="bg-white rounded-xl border border-[#e6eaf0] divide-y divide-slate-100">
              {[
                { label: "즉시 확인", value: `${actionKpi.immediateReview}건` },
                { label: "차단 위험", value: `${actionKpi.blockRisk}건` },
              ].map((k) => (
                <div key={k.label} className="flex items-center justify-between px-3.5 py-2.5 text-[12px]">
                  <span className="text-slate-500">{k.label}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{k.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ KPI Strip ═══ */}
        <div className="hidden md:grid md:grid-cols-2 gap-3">{/* §mobile-budgets — 모바일은 위 요약/승격 카드로 대체(패리티: 상세 › 전체) */}
          {[
            {
              icon: <AlertTriangle className="h-4 w-4" />,
              iconColor: "text-red-500",
              cardBg: actionKpi.immediateReview > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200",
              valueColor: actionKpi.immediateReview > 0 ? "text-red-600" : "text-slate-900",
              label: "즉시 확인",
              value: `${actionKpi.immediateReview}건`,
              sub: actionKpi.immediateReview > 0 ? "초과 항목 검토 필요" : "초과 항목 없음",
            },
            {
              icon: <Clock className="h-4 w-4" />,
              iconColor: "text-yellow-500",
              cardBg: actionKpi.blockRisk > 0 ? "bg-yellow-50 border-yellow-200" : "bg-white border-slate-200",
              valueColor: actionKpi.blockRisk > 0 ? "text-yellow-600" : "text-slate-900",
              label: "차단 위험",
              value: `${actionKpi.blockRisk}건`,
              sub: actionKpi.blockRisk > 0 ? "임계 구간 · 곧 차단 가능" : "임계치 안전",
            },
          ].map((kpi) => (
            <div key={kpi.label} className={`min-w-[140px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border p-3.5 sm:p-4 hover:shadow-sm transition-shadow ${kpi.cardBg}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={kpi.iconColor}>{kpi.icon}</span>
                <p className="text-[11px] text-slate-500 font-medium">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-extrabold tabular-nums ${kpi.valueColor}`}>{kpi.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* §mobile-budgets §1 — 모바일 접힌 행 2(카테고리별 지출·예산 풀별 소진율), 데이터 시 제자리 확장 */}
        <div className="md:hidden bg-white rounded-2xl border border-[#e6eaf0] px-4 py-1.5 divide-y divide-slate-100">
          {activeOrgId && budgets.length > 0 ? (
            <div className="py-3.5">
              <p className="text-[13px] font-bold text-slate-800 mb-2">카테고리별 지출</p>
              <CategorySpendingWidget organizationId={activeOrgId} />
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3 min-h-[44px]">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-700">카테고리별 지출</p>
                <p className="text-[11px] text-slate-400">집계된 지출이 생기면 표시돼요</p>
              </div>
              <span className="text-[11px] text-slate-300" aria-disabled="true">›</span>
            </div>
          )}
          {/* §budget-fabricated-figures — 라벨은 「예산 풀별」인데 부서 집계(aggregateDepartments)를 그렸다.
              부서 열이 DB 에 없어 언제나 「미지정」 한 줄이었다. 실제 예산 풀의 소진율(실데이터)로 교체. */}
          {controls.length > 0 ? (
            <div className="py-3.5">
              <p className="text-[13px] font-bold text-slate-800 mb-2">예산 풀별 소진율</p>
              <div className="space-y-2.5">
                {controls.slice(0, 3).map((c: BudgetWithControl) => {
                  const rate = Math.round(c.ctrl.burnRate);
                  return (
                    <div key={c.budget.id}>
                      <div className="flex items-center justify-between mb-1 text-[12px]">
                        <span className="font-semibold text-slate-700 truncate">{c.budget.name}</span>
                        <span className="tabular-nums text-slate-500">{rate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${rate > 100 ? "bg-red-500" : rate >= 80 ? "bg-yellow-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3 min-h-[44px]">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-700">예산 풀별 소진율</p>
                <p className="text-[11px] text-slate-400">예산 풀이 등록되면 소진율이 표시돼요</p>
              </div>
              <span className="text-[11px] text-slate-300" aria-disabled="true">›</span>
            </div>
          )}
        </div>

        {/* ═══ 카테고리별 예산 사용 현황 ═══ */}
        {activeOrgId && (
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 p-5">
            <CategorySpendingWidget organizationId={activeOrgId} />
          </div>
        )}

        {/* 🛑 §budget-fabricated-figures (2026-09-20 · 릴레이 판정) — 지운 블록 3개.
              월별 지출 추이  실지출을 한 번도 읽지 않았다. 총예산÷12 × 고정계수[0.7·0.85·0.9·1.05·1.1·0.95]
                             를 1~6월 라벨에 얹은 합성값이었다(예산 기간이 8~12월인데도 1~6월을 그렸다).
              부서별 TOP 3    묶는 키 targetDepartment 가 DB 에 없다 → 언제나 「미지정」 1줄.
              AI 인사이트     고정 문장이었다(코드 주석이 `AI Insight mock`). 분석 엔진·입력 0.
              되살릴 때의 조건: 월별은 PurchaseRecord 실적으로, 부서별은 부서 열이 생긴 뒤.
              계약: __tests__/regression/budget-fabricated-figures.test.ts */}
        {budgets.length > 0 && (
          <div className="hidden md:block rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
            <p className="text-[13px] font-bold text-gray-500">지출 추이·부서별 소진 데이터 없음</p>
            <p className="mt-0.5 text-xs text-gray-500">
              월별 추이와 부서별 소진은 아직 실제 지출 기록과 연결되지 않았습니다. 예산별 소진은 아래 목록에서 확인하세요.
            </p>
          </div>
        )}

        {/* ═══ Search Bar ═══ */}
        {budgets.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="예산명, 프로젝트로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
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
          <div className="hidden md:block"><EmptyState onCreateClick={() => { setEditingBudget(null); setIsDialogOpen(true); }} /></div>
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
                : ctrl.risk === "critical" ? "bg-red-500"
                : ctrl.risk === "warning" ? "bg-yellow-400"
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
                        {b.projectName && <><span className="text-slate-400">{b.projectName}</span>{" · "}</>}
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
                      {b.projectName ?? ""}
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
              /* §budget-fabricated-figures — 지운 카드 3개.
                 미매핑 요청   count: 0 리터럴(집계 없음) · 승인 대기 항상 0(reserved 상수 0) ·
                 발주 전환 대기 라벨은 견적인데 실제로는 「정상 예산 행 수」를 세고 있었다. */
              { label: "초과 위험 감지", count: actionKpi.blockRisk + actionKpi.immediateReview, sub: "임계 구간 · 초과 건 검토", href: "/dashboard/budget" },
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

        {/* 🛑 §budget-fabricated-figures — 「AI 예산 이상 탐지 & 예측」 블록 제거.
              블록 설명문은 「과거 지출 패턴을 분석하여…」 였으나 과거 지출을 읽는 코드가 없었다.
              3장 중 2장은 조건 없이 항상 렌더되는 고정 문장이었고(5개 프로젝트·PBS·Ethanol·₩1.2M,
              「상반기 예산 2주차 조기 소진」), 1장은 예산 이름만 실제이고 42%·3개월은 고정이었다.
              되살리려면 입력 데이터를 받는 엔진이 먼저 있어야 한다. */}

      {/* §mobile-budgets 7b — 공용 등록 시트. onSuccess = 배너 dismiss + 목록 실계산 + analytics 활성화 2/3 invalidate */}
      <BudgetRegisterSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSuccess={() => {
          setBannerDismissed(true);
          toast({ title: "예산 풀이 등록되었습니다." });
          void fetchBudgets();
          queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
        }}
      />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 반원 게이지 (소진율 미리보기) — currentColor stroke로 톤 제어
// ═══════════════════════════════════════════════════════════════════
function Gauge({ pct, colorClass }: { pct: number; colorClass: string }) {
  const r = 46;
  const circ = Math.PI * r;
  const off = circ * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg viewBox="0 0 120 70" className={`w-[120px] h-[70px] ${colorClass}`} role="img" aria-label={`소진율 ${pct}%`}>
      <path d="M14 62 A46 46 0 0 1 106 62" fill="none" stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
      <path d="M14 62 A46 46 0 0 1 106 62" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a">{pct}%</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Empty State — 예산 0건 온보딩(통제 시작 유도)
// CTA는 실 동작만 연결: onCreateClick(실 등록 다이얼로그) / purchases 링크.
// 임계치는 시스템 자동(소진율 60% 주의·80% 위험·100% 초과, deriveBudgetControl).
// ═══════════════════════════════════════════════════════════════════
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  const previews: { name: string; pct: number; colorClass: string; badge: string; badgeClass: string }[] = [
    { name: "2026 Q2 시약", pct: 55, colorClass: "text-emerald-500", badge: "정상", badgeClass: "text-emerald-600" },
    { name: "장비 구매", pct: 72, colorClass: "text-yellow-500", badge: "주의 구간", badgeClass: "text-yellow-600" },
    { name: "공용 소모품", pct: 96, colorClass: "text-red-500", badge: "위험 · 차단 임계", badgeClass: "text-red-600" },
  ];
  return (
    <div className="space-y-5">
      {/* ── 온보딩 히어로 ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 md:p-8 text-white">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-blue-300 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
          </span>
          예산 통제 시작하기
        </span>
        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight leading-snug max-w-xl">
          예산 풀을 만들면 초과 지출을 사전에 막을 수 있어요
        </h2>
        <p className="text-sm text-white/70 leading-relaxed mt-2.5 max-w-2xl">
          예산을 등록하면 요청·견적·발주 흐름에서 <b className="text-white font-semibold">예산 초과를 미리 차단</b>하고,
          소진율이 임계 구간에 도달하면 자동으로 경고합니다. 2분이면 첫 분기 예산을 설정할 수 있어요.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
          <Button onClick={onCreateClick} className="bg-blue-600 hover:bg-blue-500 text-white">
            <Plus className="h-4 w-4 mr-1.5" />첫 예산 풀 만들기
          </Button>
          <Link href="/dashboard/purchases">
            <Button variant="outline" className="w-full sm:w-auto border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              기존 요청과 연결
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 설정 3단계 ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">예산 설정 3단계</h3>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">0 / 3 완료</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1 — 실 등록 다이얼로그 */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <h4 className="text-sm font-semibold text-slate-900">예산 풀 만들기</h4>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed mb-3">분기·팀·과제 단위로 예산 풀을 만들고 총액을 입력합니다.</p>
            <button onClick={onCreateClick} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
              지금 만들기 <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Step 2 — 자동 임계(시스템 고정) 설명, 데드/데모 버튼 없음 */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">2</span>
              <h4 className="text-sm font-semibold text-slate-900">자동 임계 경고</h4>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed mb-3">소진율에 따라 자동 분류됩니다 · 60% 주의 · 80% 위험 · 100% 초과.</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Clock className="h-3.5 w-3.5" /> 예산 생성 시 자동 적용
            </span>
          </div>
          {/* Step 3 — 구매 흐름 연결(실 링크) */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">3</span>
              <h4 className="text-sm font-semibold text-slate-900">구매 흐름 연결</h4>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed mb-3">요청·견적·발주에 예산을 연결하면 자동 통제가 켜집니다.</p>
            <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
              요청 연결하기 <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 등록 후 미리보기(예시) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">등록하면 이렇게 보입니다</h3>
          <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">예시 미리보기</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {previews.map((p) => (
            <div key={p.name} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
              <div className="text-[13px] font-semibold text-slate-800 mb-1.5">{p.name}</div>
              <div className="flex justify-center"><Gauge pct={p.pct} colorClass={p.colorClass} /></div>
              <div className={`text-[11px] font-semibold mt-1.5 ${p.badgeClass}`}>{p.badge}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">* 실제 데이터가 아닌 예시입니다. 예산을 등록하면 집행 현황이 실시간 게이지로 표시됩니다.</p>
      </div>

      {/* ── 등록 후 자동으로 켜지는 통제 ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">예산 등록 후 자동으로 켜지는 통제</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-medium text-slate-700">요청 차단</span>
              <span className="block mt-0.5 text-[11px] text-slate-400">예산 잔액 부족 시 요청 단계에서 자동 차단</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-medium text-slate-700">대체 제안</span>
              <span className="block mt-0.5 text-[11px] text-slate-400">초과 위험 시 대체 시약·절감 옵션 자동 분석</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-medium text-slate-700">승인 라우팅</span>
              <span className="block mt-0.5 text-[11px] text-slate-400">임계치 도달 시 예외 승인 경로로 자동 분기</span>
            </div>
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
      projectName: projectName.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="name" className="text-sm font-semibold text-slate-700">예산 이름 <span className="text-red-500">*</span></Label>
        <Input id="name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }} placeholder="예: 2026 하반기 소모품비" required className={`mt-1.5 rounded-xl h-11 ${errors.name ? "border-red-400 ring-1 ring-red-200 focus-visible:ring-red-300" : "border-slate-200"}`} />
        {errors.name && <p className="text-[12px] font-medium text-red-500 mt-1.5">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount" className="text-sm font-semibold text-slate-700">예산 금액 <span className="text-red-500">*</span></Label>
          <div className="relative mt-1.5">
            <Input id="amount" type="text" value={formatAmount(amount)} onChange={handleAmountChange} placeholder="0" required className={`rounded-xl h-11 ${errors.amount ? "border-red-400 ring-1 ring-red-200 focus-visible:ring-red-300" : "border-slate-200"}`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{currency}</span>
          </div>
          {errors.amount && <p className="text-[12px] font-medium text-red-500 mt-1.5">{errors.amount}</p>}
        </div>
        <div>
          <Label htmlFor="currency" className="text-sm font-semibold text-slate-700">통화 <span className="text-red-500">*</span></Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="mt-1.5 rounded-xl h-11 border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="z-[9999] rounded-xl">
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
          <Label htmlFor="periodStart" className="text-sm font-semibold text-slate-700">기간 시작 <span className="text-red-500">*</span></Label>
          <DatePicker date={periodStart || undefined} onDateChange={(d: Date | undefined) => setPeriodStart(d || null)} placeholder="연도-월-일" maxDate={periodEnd || undefined} className={`mt-1.5 rounded-xl h-11 ${errors.periodStart ? "border-red-400 ring-1 ring-red-200" : "border-slate-200"}`} />
          {errors.periodStart && <p className="text-[12px] font-medium text-red-500 mt-1.5">{errors.periodStart}</p>}
        </div>
        <div>
          <Label htmlFor="periodEnd" className="text-sm font-semibold text-slate-700">기간 종료 <span className="text-red-500">*</span></Label>
          <DatePicker date={periodEnd || undefined} onDateChange={(d: Date | undefined) => setPeriodEnd(d || null)} placeholder="연도-월-일" minDate={periodStart || undefined} className={`mt-1.5 rounded-xl h-11 ${errors.periodEnd ? "border-red-400 ring-1 ring-red-200" : "border-slate-200"}`} />
          {errors.periodEnd && <p className="text-[12px] font-medium text-red-500 mt-1.5">{errors.periodEnd}</p>}
        </div>
      </div>
      {periodStart && periodEnd && (
        <div className="px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700">
          <Calendar className="h-3 w-3 inline mr-1" />
          예산 기간: {periodStart.toLocaleDateString("ko-KR")} ~ {periodEnd.toLocaleDateString("ko-KR")} ({Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))}일)
        </div>
      )}
      {/* 🛑 §budget-fabricated-figures — 「대상 부서/팀」 입력 제거.
          필수 입력이었는데 서버(POST /api/budgets)가 저장하지 않았고 DB 에 열도 없다.
          저장되지 않는 입력은 두지 않는다. 부서 구분이 실제로 필요해지면 열부터 만든다. */}
      <div>
        <Label htmlFor="projectName" className="text-sm font-semibold text-slate-700">프로젝트/과제명 (선택)</Label>
        <Input id="projectName" value={projectName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)} placeholder="예: 신약 개발 프로젝트" className="mt-1.5 rounded-xl h-11 border-slate-200" />
      </div>
      <div>
        <Label htmlFor="description" className="text-sm font-semibold text-slate-700">설명 (선택)</Label>
        <Textarea id="description" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder="예산에 대한 추가 설명" rows={3} className="mt-1.5 rounded-xl resize-none border-slate-200" />
      </div>
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[12px] font-medium text-red-600">{submitError}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 pt-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 font-semibold" disabled={isSubmitting}>취소</Button>
        <Button type="submit" className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{budget ? "수정 중..." : "저장 중..."}</>) : (budget ? "예산 수정 저장" : "예산안 저장")}
        </Button>
      </div>
    </form>
  );
}
