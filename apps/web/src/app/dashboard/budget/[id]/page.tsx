"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  Wallet,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Clock,
  ChevronRight,
  Package,
  Send,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Budget = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  targetDepartment?: string | null;
  projectName?: string | null;
  description?: string | null;
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
};

// ── 예산 통제 파생 ──
function deriveBudgetControl(b: Budget) {
  const total = b.amount;
  const actual = b.usage?.totalSpent ?? 0;
  const reserved = 0; // chain 연결 후 실데이터로 교체
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

  // 기간 내 잔여일/소진 예측
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const dailyBurn = elapsedDays > 0 ? actual / elapsedDays : 0;
  const forecastExhaustDays = dailyBurn > 0 ? Math.ceil(available / dailyBurn) : null;

  return { total, reserved, committed, actual, available, burnRate, risk, remainingDays, forecastExhaustDays, dailyBurn, totalDays, elapsedDays };
}

const RISK_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  safe: { label: "정상", color: "text-emerald-400", bgColor: "bg-emerald-600/10", borderColor: "border-emerald-600/30" },
  warning: { label: "주의", color: "text-amber-400", bgColor: "bg-amber-600/10", borderColor: "border-amber-600/30" },
  critical: { label: "경고", color: "text-orange-400", bgColor: "bg-orange-600/10", borderColor: "border-orange-600/30" },
  over: { label: "초과", color: "text-red-400", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
  ended: { label: "종료", color: "text-slate-500", bgColor: "bg-slate-600/5", borderColor: "border-slate-600/20" },
  upcoming: { label: "예정", color: "text-blue-400", bgColor: "bg-blue-600/10", borderColor: "border-blue-600/30" },
};

// ── Mock linked activities (chain 연결 전) ──
const MOCK_LINKED_ACTIVITIES: any[] = [];

// ── Mock policy rules ──
const DEFAULT_POLICY = {
  warningThreshold: 80,
  hardBlock: 100,
  categoryRestrictions: [] as string[],
  approvalRequired: false,
  varianceThreshold: 10,
};

function BudgetDetailSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#2d2f33' }}>
      <div className="h-11 border-b border-bd animate-pulse" style={{ backgroundColor: '#434548' }} />
      <div className="h-12 border-b border-bd animate-pulse" style={{ backgroundColor: '#393b3f' }} />
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded border border-bd animate-pulse" style={{ backgroundColor: '#393b3f' }} />
        ))}
      </div>
    </div>
  );
}

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  const { toast } = useToast();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/budgets/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed to fetch budget");
      const json = await res.json();
      setBudget(json.budget ?? null);
      if (!json.budget) setNotFound(true);
    } catch (err) {
      console.error("[BudgetDetailPage] Error fetching budget:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2d2f33' }}>
        <p className="text-sm text-slate-400">잘못된 접근입니다.</p>
      </div>
    );
  }
  if (isLoading) return <BudgetDetailSkeleton />;
  if (notFound || !budget) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2d2f33' }}>
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-400">해당 예산 정보를 찾을 수 없습니다.</p>
          <Link href="/dashboard/budget" className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300">
            <ArrowLeft className="w-4 h-4 mr-1" />예산 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const ctrl = deriveBudgetControl(budget);
  const riskCfg = RISK_CONFIG[ctrl.risk];
  const startStr = new Date(budget.periodStart).toLocaleDateString("ko-KR");
  const endStr = new Date(budget.periodEnd).toLocaleDateString("ko-KR");
  const formatAmt = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
  const formatK = (n: number) => {
    if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₩${(n / 1_000).toFixed(0)}K`;
    return `₩${n.toLocaleString("ko-KR")}`;
  };
  const policy = DEFAULT_POLICY;

  const handleExcelDownload = async () => {
    try {
      toast({ title: "엑셀 다운로드", description: "보고서를 생성하고 있습니다..." });
      const res = await fetch(`/api/budget/report?budgetId=${id}`);
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error || "다운로드 실패"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `budget_report_${id}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
    } catch (err: any) {
      toast({ title: "다운로드 실패", description: err.message || "알 수 없는 오류", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#2d2f33' }}>
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-700 tracking-tight">LabAxis</span></Link>
          <div className="w-px h-5 bg-bd" />
          <span className="text-xs md:text-sm font-medium text-slate-400">예산 통제</span>
          <div className="w-px h-4 bg-bd" />
          <span className="text-xs text-slate-500 truncate max-w-[200px]">{budget.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-700" onClick={handleExcelDownload}>
            <FileSpreadsheet className="h-3 w-3 mr-1" />내보내기
          </Button>
          <Link href="/dashboard/budget">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500"><ArrowLeft className="h-3 w-3 mr-1" />목록</Button>
          </Link>
        </div>
      </div>

      {/* ═══ Judgment Strip: 5 KPI + risk + forecast ═══ */}
      <div className="border-b border-bd" style={{ backgroundColor: '#393b3f' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-medium ${riskCfg.color} ${riskCfg.bgColor} ${riskCfg.borderColor}`}>{riskCfg.label}</span>
            <span className="text-[10px] text-slate-500">{startStr} ~ {endStr}</span>
            <span className="text-[10px] text-slate-500">{budget.targetDepartment || "부서 미지정"}</span>
            {budget.projectName && <span className="text-[10px] text-slate-500">{budget.projectName}</span>}
            <span className="text-[10px] text-slate-500">잔여 {ctrl.remainingDays}일</span>
            {ctrl.forecastExhaustDays !== null && ctrl.risk !== "ended" && (
              <span className={`text-[10px] ${ctrl.forecastExhaustDays < ctrl.remainingDays ? 'text-red-400' : 'text-slate-500'}`}>
                소진 예측 {ctrl.forecastExhaustDays}일
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">총액</div>
              <div className="text-lg font-bold text-slate-700 tabular-nums">{formatAmt(ctrl.total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">예약 (Reserved)</div>
              <div className="text-lg font-bold text-blue-400/70 tabular-nums">{formatAmt(ctrl.reserved)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">확정 (Committed)</div>
              <div className="text-lg font-bold text-amber-400/70 tabular-nums">{formatAmt(ctrl.committed)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">집행 (Actual)</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{formatAmt(ctrl.actual)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">가용 (Available)</div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{formatAmt(ctrl.available)}</div>
            </div>
          </div>
          {/* Budget bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden flex">
              {ctrl.actual > 0 && (
                <div className="h-full bg-slate-400" style={{ width: `${Math.min((ctrl.actual / ctrl.total) * 100, 100)}%` }} />
              )}
              {ctrl.committed > 0 && (
                <div className="h-full bg-amber-500/50" style={{ width: `${Math.min((ctrl.committed / ctrl.total) * 100, 100 - (ctrl.actual / ctrl.total) * 100)}%` }} />
              )}
              {ctrl.reserved > 0 && (
                <div className="h-full bg-blue-500/30" style={{ width: `${Math.min((ctrl.reserved / ctrl.total) * 100, 100 - ((ctrl.actual + ctrl.committed) / ctrl.total) * 100)}%` }} />
              )}
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{Math.round(ctrl.burnRate)}%</span>
          </div>
        </div>
      </div>

      {/* ═══ Main Content: Center + Right Rail ═══ */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex gap-4">
          {/* ── Center Work Window ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Block A: 연결된 구매 활동 (chain linked items) */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">연결된 구매 활동</span>
              </div>
              {MOCK_LINKED_ACTIVITIES.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Package className="h-8 w-8 mx-auto text-slate-600 mb-3" />
                  <p className="text-xs text-slate-400 mb-1">아직 연결된 구매 활동이 없습니다</p>
                  <p className="text-[10px] text-slate-500 mb-4 max-w-sm mx-auto">
                    요청/견적/발주가 이 예산에 연결되면 예약·확정·집행 금액이 자동 반영되고
                    활동 큐가 여기에 표시됩니다.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Link href="/dashboard/quotes">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-bd text-slate-400 hover:text-slate-700">
                        <Send className="h-3 w-3 mr-1" />견적 보기
                      </Button>
                    </Link>
                    <Link href="/dashboard/orders">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-bd text-slate-400 hover:text-slate-700">
                        <FileCheck className="h-3 w-3 mr-1" />발주 보기
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-bd">
                  {/* 실 데이터 연결 시 여기에 행 렌더링 */}
                </div>
              )}
            </div>

            {/* Block B: 예산 차단/경고 (blockers) */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">통제 상태</span>
              </div>
              <div className="p-4 space-y-2">
                {/* Threshold guard */}
                <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                  <div className="flex items-center gap-2 text-xs">
                    {ctrl.burnRate < policy.warningThreshold
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : ctrl.burnRate < policy.hardBlock
                        ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        : <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    }
                    <span className="text-slate-600">경고 임계치 ({policy.warningThreshold}%)</span>
                  </div>
                  <span className={`text-[10px] ${ctrl.burnRate < policy.warningThreshold ? "text-emerald-400" : ctrl.burnRate < policy.hardBlock ? "text-amber-400" : "text-red-400"}`}>
                    {ctrl.burnRate < policy.warningThreshold ? "정상" : ctrl.burnRate < policy.hardBlock ? "주의 구간" : "초과 차단"}
                  </span>
                </div>

                {/* Hard block guard */}
                <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                  <div className="flex items-center gap-2 text-xs">
                    {ctrl.burnRate < policy.hardBlock
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    }
                    <span className="text-slate-600">초과 차단 ({policy.hardBlock}%)</span>
                  </div>
                  <span className={`text-[10px] ${ctrl.burnRate < policy.hardBlock ? "text-emerald-400" : "text-red-400"}`}>
                    {ctrl.burnRate < policy.hardBlock ? "차단 없음" : "신규 발주 차단"}
                  </span>
                </div>

                {/* Forecast guard */}
                {ctrl.forecastExhaustDays !== null && ctrl.risk !== "ended" && ctrl.risk !== "upcoming" && (
                  <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                    <div className="flex items-center gap-2 text-xs">
                      {ctrl.forecastExhaustDays > ctrl.remainingDays
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      }
                      <span className="text-slate-600">소진 예측</span>
                    </div>
                    <span className={`text-[10px] ${ctrl.forecastExhaustDays > ctrl.remainingDays ? "text-emerald-400" : "text-amber-400"}`}>
                      {ctrl.forecastExhaustDays > ctrl.remainingDays
                        ? `기간 내 여유 (${ctrl.forecastExhaustDays}일 후 소진)`
                        : `기간 종료 전 소진 가능 (${ctrl.forecastExhaustDays}일 후)`
                      }
                    </span>
                  </div>
                )}

                {ctrl.risk === "safe" && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />모든 통제 조건 충족
                  </div>
                )}
              </div>
            </div>

            {/* Block C: 집행 내역 (chain 연결 후 실데이터로 교체) */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">예산 영향 이력</span>
              </div>
              <div className="px-4 py-8 text-center">
                <Clock className="h-7 w-7 mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 mb-1">아직 예산 영향 이력이 없습니다</p>
                <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                  요청/견적/발주가 연결되면 reserved/committed/actual 변동 이력이 시간순으로 표시됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right Rail ── */}
          <div className="hidden lg:flex w-[320px] shrink-0 flex-col gap-4">
            {/* Budget Rules */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">통제 규칙</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">경고 임계치</span>
                  <span className="text-slate-700">{policy.warningThreshold}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">초과 차단</span>
                  <span className="text-slate-700">{policy.hardBlock}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">편차 허용</span>
                  <span className="text-slate-700">±{policy.varianceThreshold}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">승인 필요</span>
                  <span className="text-slate-700">{policy.approvalRequired ? "필요" : "불필요"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">카테고리 제한</span>
                  <span className="text-slate-700">{policy.categoryRestrictions.length > 0 ? policy.categoryRestrictions.join(", ") : "없음"}</span>
                </div>
              </div>
            </div>

            {/* Budget Info */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">예산 정보</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">소유자</span>
                  <span className="text-slate-700">{budget.targetDepartment || "미지정"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">프로젝트</span>
                  <span className="text-slate-700">{budget.projectName || "미지정"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">기간</span>
                  <span className="text-slate-700">{startStr} ~ {endStr}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">경과</span>
                  <span className="text-slate-700">{ctrl.elapsedDays}일 / {ctrl.totalDays}일</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">일평균 소진</span>
                  <span className="text-slate-700 tabular-nums">{formatK(Math.round(ctrl.dailyBurn))}/일</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">통화</span>
                  <span className="text-slate-700">{budget.currency}</span>
                </div>
                {budget.description && (
                  <div className="pt-2 border-t border-bd">
                    <div className="text-[10px] text-slate-500 mb-1">설명</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{budget.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Exception / Override History (placeholder) */}
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <span className="text-xs font-medium text-slate-700">예외/조정 이력</span>
              </div>
              <div className="px-4 py-6 text-center">
                <p className="text-[10px] text-slate-500">
                  예산 증액, 이관, 예외 승인 이력이 여기에 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
