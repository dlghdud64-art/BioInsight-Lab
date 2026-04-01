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
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Calendar, Wallet, TrendingUp, Loader2, Lock, AlertTriangle, AlertCircle, CheckCircle2, Search, ChevronRight, ArrowUpRight, ShieldAlert } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/permission-gate";
import Link from "next/link";

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

// ── 예산 통제 파생 계산 (mock: reserved/committed는 서버 연동 전 spent 기반 추정) ──
function deriveBudgetControl(b: Budget) {
  const total = b.amount;
  const actual = b.usage?.totalSpent ?? 0;
  // 서버 연동 전 mock: reserved/committed는 0 (chain 연결 후 실데이터로 교체)
  const reserved = 0;
  const committed = 0;
  const available = Math.max(total - reserved - committed - actual, 0);
  const burnRate = total > 0 ? ((reserved + committed + actual) / total) * 100 : 0;

  const now = new Date();
  const start = new Date(b.periodStart);
  const end = new Date(b.periodEnd);

  let risk: "safe" | "warning" | "critical" | "over" | "ended" | "upcoming" = "safe";
  if (now > end) risk = "ended";
  else if (now < start) risk = "upcoming";
  else if (burnRate > 100) risk = "over";
  else if (burnRate >= 80) risk = "critical";
  else if (burnRate >= 60) risk = "warning";

  return { total, reserved, committed, actual, available, burnRate, risk };
}

const RISK_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  safe: { label: "정상", color: "text-emerald-400", bgColor: "bg-emerald-600/10", borderColor: "border-emerald-600/30" },
  warning: { label: "주의", color: "text-amber-400", bgColor: "bg-amber-600/10", borderColor: "border-amber-600/30" },
  critical: { label: "경고", color: "text-orange-400", bgColor: "bg-orange-600/10", borderColor: "border-orange-600/30" },
  over: { label: "초과", color: "text-red-400", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
  ended: { label: "종료", color: "text-slate-500", bgColor: "bg-slate-600/5", borderColor: "border-slate-600/20" },
  upcoming: { label: "예정", color: "text-blue-400", bgColor: "bg-blue-600/10", borderColor: "border-blue-600/30" },
};

// Radix UI SelectItem은 value=""를 허용하지 않음 - placeholder는 SelectValue에서 처리
const BUDGET_DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "공정개발팀", label: "공정개발팀" },
  { value: "기초연구팀", label: "기초연구팀" },
  { value: "품질관리(QC)팀", label: "품질관리(QC)팀" },
  { value: "전체(공용 예산)", label: "전체(공용 예산)" },
];

const INITIAL_BUDGETS: Budget[] = [];

export default function BudgetPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>(INITIAL_BUDGETS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { can, organizationId: activeOrgId, isAdminOrOwner: canEditBudget } = usePermission();

  /** 예산 목록 서버에서 불러오기 (silent: true 시 로딩 UI 없이 백그라운드 갱신) */
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
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // ── 통제 summary 파생 ──
  const controlSummary = useMemo(() => {
    const controls = budgets.map((b) => ({ budget: b, ctrl: deriveBudgetControl(b) }));
    const active = controls.filter((c) => c.ctrl.risk !== "ended" && c.ctrl.risk !== "upcoming");
    const atThreshold = controls.filter((c) => c.ctrl.risk === "warning" || c.ctrl.risk === "critical");
    const overBudget = controls.filter((c) => c.ctrl.risk === "over");
    const totalBudget = controls.reduce((s, c) => s + c.ctrl.total, 0);
    const totalActual = controls.reduce((s, c) => s + c.ctrl.actual, 0);
    const totalAvailable = controls.reduce((s, c) => s + c.ctrl.available, 0);
    return { controls, active, atThreshold, overBudget, totalBudget, totalActual, totalAvailable };
  }, [budgets]);

  const filteredControls = useMemo(() => {
    if (!searchQuery.trim()) return controlSummary.controls;
    const q = searchQuery.toLowerCase();
    return controlSummary.controls.filter((c) =>
      c.budget.name.toLowerCase().includes(q) ||
      c.budget.targetDepartment?.toLowerCase().includes(q) ||
      c.budget.projectName?.toLowerCase().includes(q)
    );
  }, [controlSummary.controls, searchQuery]);

  /** 예산 추가/수정: API 호출 + 로컬 상태 반영 */
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
        const message =
          (json as any)?.error ||
          (json as any)?.details ||
          "예산 반영 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        console.error("[BudgetPage] Failed to save budget:", json);
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
        usage: {
          totalSpent: 0,
          usageRate: 0,
          remaining: apiBudget?.amount ?? formData.amount ?? 0,
        },
      };

      if (editingBudget) {
        setBudgets((prev) =>
          prev.map((b) =>
            b.id === editingBudget.id
              ? { ...mappedBudget, usage: editingBudget.usage }
              : b
          )
        );
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
          toast({ title: "새 예산이 성공적으로 등록되었습니다." });
          await fetchBudgets();
        }
      }
    } catch (error) {
      console.error("[BudgetPage] Unexpected error while saving budget:", error);
      setSubmitError(
        "통신이 일시적으로 원활하지 않습니다. 입력 내용을 보존했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "예산이 삭제되었습니다." });
  };

  const formatK = (n: number) => {
    if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₩${(n / 1_000).toFixed(0)}K`;
    return `₩${n.toLocaleString("ko-KR")}`;
  };

  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#2d2f33' }}>
      {/* ═══ Header ═══ */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span></Link>
            <div className="w-px h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">예산 통제</span>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={(open: boolean) => { setIsDialogOpen(open); if (!open) { setEditingBudget(null); setSubmitError(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingBudget(null)} size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-slate-200">
                  <Plus className="h-3 w-3 mr-1" />예산 등록
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
                  onSubmit={(data) => handleAddBudget(data)}
                  onCancel={() => { setIsDialogOpen(false); setEditingBudget(null); }}
                />
              </DialogContent>
            </Dialog>
            <Link href="/dashboard/quotes"><Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500">워크큐</Button></Link>
          </div>
        </div>
      </div>

      {/* ═══ Summary Strip ═══ */}
      <div className="border-b border-bd" style={{ backgroundColor: '#393b3f' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">전체 예산</div>
              <div className="text-sm font-bold text-slate-200 tabular-nums">{budgets.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">운영 중</div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{controlSummary.active.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">임계치 접근</div>
              <div className="text-sm font-bold text-amber-400 tabular-nums">{controlSummary.atThreshold.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">초과</div>
              <div className="text-sm font-bold text-red-400 tabular-nums">{controlSummary.overBudget.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">총 집행</div>
              <div className="text-sm font-bold text-slate-200 tabular-nums">{formatK(controlSummary.totalActual)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">총 가용</div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{formatK(controlSummary.totalAvailable)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="예산명, 부서, 프로젝트로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded border border-bd bg-pn text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>

        {isFetching ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded border border-bd animate-pulse" style={{ backgroundColor: '#393b3f' }} />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          /* ── Guided Empty State ── */
          <div className="rounded-lg border border-bd px-6 py-16 text-center" style={{ backgroundColor: '#393b3f' }}>
            <ShieldAlert className="h-10 w-10 mx-auto text-slate-500 mb-4" />
            <p className="text-sm text-slate-300 mb-1.5">등록된 예산이 없습니다</p>
            <p className="text-xs text-slate-500 mb-5 max-w-md mx-auto">
              예산을 등록하면 요청/견적/발주 흐름에서 예산 초과 여부를 사전에 확인하고,
              임계치에 도달하면 자동으로 경고합니다.
            </p>
            <Button size="sm" onClick={() => { setEditingBudget(null); setIsDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />예산 등록하기
            </Button>
          </div>
        ) : (
          /* ── Budget Control Table ── */
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_100px_100px_100px_100px_100px_80px_80px_60px] gap-px px-4 py-2 border-b border-bd text-[10px] uppercase tracking-wider text-slate-500" style={{ backgroundColor: '#434548' }}>
              <span>예산</span>
              <span className="text-right">총액</span>
              <span className="text-right">예약</span>
              <span className="text-right">확정</span>
              <span className="text-right">집행</span>
              <span className="text-right">가용</span>
              <span className="text-center">소진율</span>
              <span className="text-center">리스크</span>
              <span />
            </div>
            {/* Rows */}
            {filteredControls.map(({ budget, ctrl }) => {
              const riskCfg = RISK_CONFIG[ctrl.risk];
              return (
                <Link
                  key={budget.id}
                  href={`/dashboard/budget/${budget.id}`}
                  className="block border-b border-bd last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[1fr_100px_100px_100px_100px_100px_80px_80px_60px] gap-px items-center px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{budget.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {budget.targetDepartment || "부서 미지정"}
                        {budget.projectName && ` · ${budget.projectName}`}
                        {" · "}
                        {new Date(budget.periodStart).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        {" ~ "}
                        {new Date(budget.periodEnd).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 text-right tabular-nums">{formatK(ctrl.total)}</div>
                    <div className="text-xs text-blue-400/70 text-right tabular-nums">{formatK(ctrl.reserved)}</div>
                    <div className="text-xs text-amber-400/70 text-right tabular-nums">{formatK(ctrl.committed)}</div>
                    <div className="text-xs text-slate-200 text-right tabular-nums">{formatK(ctrl.actual)}</div>
                    <div className="text-xs text-emerald-400 text-right tabular-nums font-medium">{formatK(ctrl.available)}</div>
                    <div className="text-center">
                      <div className="inline-flex items-center">
                        <div className="w-10 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ctrl.burnRate > 100 ? 'bg-red-500' : ctrl.burnRate >= 80 ? 'bg-orange-500' : ctrl.burnRate >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(ctrl.burnRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 ml-1.5 tabular-nums">{Math.round(ctrl.burnRate)}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${riskCfg.color} ${riskCfg.bgColor} ${riskCfg.borderColor}`}>
                        {riskCfg.label}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                  </div>
                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-200 truncate mr-2">{budget.name}</span>
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${riskCfg.color} ${riskCfg.bgColor} ${riskCfg.borderColor}`}>
                        {riskCfg.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mb-2">
                      {budget.targetDepartment || "부서 미지정"} · {formatK(ctrl.total)}
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-slate-400">집행 <span className="text-slate-200 tabular-nums">{formatK(ctrl.actual)}</span></span>
                      <span className="text-slate-400">가용 <span className="text-emerald-400 tabular-nums">{formatK(ctrl.available)}</span></span>
                      <span className="text-slate-400 tabular-nums">{Math.round(ctrl.burnRate)}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {filteredControls.length === 0 && budgets.length > 0 && (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                검색 조건에 맞는 예산이 없습니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Budget Form (unchanged logic, only extracted for readability)
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

  const handlePeriodStartChange = (date: Date | undefined) => {
    if (!date) { setPeriodStart(null); return; }
    setPeriodStart(date);
    if (periodEnd && date > periodEnd) setErrors((prev) => ({ ...prev, periodStart: "시작일은 종료일보다 이전이어야 합니다." }));
    else setErrors((prev) => ({ ...prev, periodStart: "" }));
  };

  const handlePeriodEndChange = (date: Date | undefined) => {
    if (!date) { setPeriodEnd(null); return; }
    setPeriodEnd(date);
    if (periodStart && date < periodStart) setErrors((prev) => ({ ...prev, periodEnd: "종료일은 시작일보다 이후여야 합니다." }));
    else setErrors((prev) => ({ ...prev, periodEnd: "" }));
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
        <Input id="name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }} placeholder="예: 2024년 R&D 예산" required className={errors.name ? "border-red-500" : ""} />
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
          <DatePicker date={periodStart || undefined} onDateChange={handlePeriodStartChange} placeholder="날짜를 선택하세요" maxDate={periodEnd || undefined} className={errors.periodStart ? "border-red-500" : ""} />
          {errors.periodStart && <p className="text-xs text-red-500 mt-1">{errors.periodStart}</p>}
        </div>
        <div>
          <Label htmlFor="periodEnd">기간 종료 *</Label>
          <DatePicker date={periodEnd || undefined} onDateChange={handlePeriodEndChange} placeholder="날짜를 선택하세요" minDate={periodStart || undefined} className={errors.periodEnd ? "border-red-500" : ""} />
          {errors.periodEnd && <p className="text-xs text-red-500 mt-1">{errors.periodEnd}</p>}
        </div>
      </div>
      {periodStart && periodEnd && (
        <div className="p-3 bg-pg rounded-lg text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          예산 기간: {periodStart.toLocaleDateString("ko-KR")} ~ {periodEnd.toLocaleDateString("ko-KR")} ({Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))}일)
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="targetDepartment">대상 부서/팀 <span className="text-red-500">*</span></Label>
        <Select value={targetDepartment} onValueChange={(v: string) => { setTargetDepartment(v); if (errors.targetDepartment) setErrors((prev) => ({ ...prev, targetDepartment: "" })); }}>
          <SelectTrigger id="targetDepartment" className={errors.targetDepartment ? "border-red-500" : ""}><SelectValue placeholder="부서를 선택해주세요" /></SelectTrigger>
          <SelectContent>
            {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "empty"} value={opt.value}>{opt.label}</SelectItem>
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
        <div className="rounded-md border border-red-200 border-red-800 bg-red-50 bg-pn px-3 py-2">
          <p className="text-xs text-red-600 text-red-400">{submitError}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>취소</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{budget ? "수정 중..." : "저장 중..."}</>) : (budget ? "예산 수정 저장" : "예산안 저장")}
        </Button>
      </div>
    </form>
  );
}
