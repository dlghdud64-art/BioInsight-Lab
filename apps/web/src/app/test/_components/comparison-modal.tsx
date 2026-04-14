"use client";

import { csrfFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  TrendingDown,
  Scale,
  Zap,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  FileText,
  RefreshCw,
  History,
  ArrowRight,
} from "lucide-react";

/* ── Types ── */
interface ProductForModal {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  specification?: string | null;
  price?: number | null;
  leadTime?: string | null;
}

interface Scenario {
  type: "cost_first" | "balanced" | "speed_first";
  title: string;
  description: string;
  isRecommended: boolean;
}

interface ProductAnalysis {
  productId: string;
  estimatedPrice: string;
  estimatedDelivery: string;
  status: "요청 가능" | "보류" | "제외";
  reason: string;
}

interface AnalysisResult {
  aiSummary: string;
  scenarios: Scenario[];
  productAnalysis: ProductAnalysis[];
}

interface ComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compareIds: string[];
  products: ProductForModal[];
  onOpenRequestWizard?: () => void;
}

/* ── Helpers ── */
const scenarioMeta: Record<string, { icon: typeof TrendingDown; label: string; shortLabel: string }> = {
  cost_first: { icon: TrendingDown, label: "비용 우선", shortLabel: "비용" },
  balanced: { icon: Scale, label: "납기·가격 균형", shortLabel: "균형" },
  speed_first: { icon: Zap, label: "최단 납기", shortLabel: "납기" },
};

const statusConfig = (status: string) => {
  switch (status) {
    case "요청 가능":
      return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" };
    case "보류":
      return { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" };
    case "제외":
      return { icon: Ban, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500" };
    default:
      return { icon: AlertCircle, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-50 text-slate-700 border border-slate-200", dot: "bg-slate-400" };
  }
};

/** 과거 구매 데이터 mock — 추후 API 연동 */
function getHistoricalHint(productId: string, brand: string | null | undefined): string | null {
  // 간단한 hash 기반 mock: brand가 있으면 가격 힌트를 생성
  if (!brand) return null;
  const hash = brand.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  if (hash % 3 === 0) return null; // 1/3 확률로 이력 없음
  const mockPrice = Math.round((hash * 137) % 50000 + 10000);
  const daysAgo = (hash % 60) + 7;
  return `${daysAgo}일 전 ₩${mockPrice.toLocaleString()}에 구매 이력`;
}

/** AI summary에서 제품명·가격 등 키워드 볼드 처리 */
function formatAiSummary(text: string, productNames: string[]): React.ReactNode {
  if (!text) return text;
  // 제품명, 가격 패턴, 퍼센트 등을 볼드
  const patterns = [
    ...productNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    "\\d{1,3}(,\\d{3})*원",
    "\\d+~?\\d*%",
    "\\d+~?\\d*영업일",
  ];
  const regex = new RegExp(`(${patterns.join("|")})`, "g");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <strong key={i} className="font-semibold text-slate-900">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function ComparisonModal({
  open,
  onOpenChange,
  compareIds,
  products,
  onOpenRequestWizard,
}: ComparisonModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const compareProducts = products.filter((p) => compareIds.includes(p.id));
  const compareKey = compareIds.slice().sort().join(",");
  const productNames = useMemo(() => compareProducts.map((p) => p.name), [compareProducts]);

  const fetchAnalysis = async () => {
    const targets = products.filter((p) => compareIds.includes(p.id));
    if (targets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/ai/compare-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: targets }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "분석 실패");
      setResult(json.data);
      // 추천 시나리오 자동 선택
      const rec = json.data.scenarios?.find((s: Scenario) => s.isRecommended);
      setActiveScenario(rec?.type ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && compareIds.length > 0) {
      setResult(null);
      setError(null);
      setActiveScenario(null);
      fetchAnalysis();
    }
    if (!open) {
      setResult(null);
      setError(null);
      setActiveScenario(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compareKey]);

  const handleOpenRequestWizard = () => {
    onOpenChange(false);
    onOpenRequestWizard?.();
  };

  // 시나리오 선택 시 해당 전략에 맞는 제품 필터 (cost_first → 가격순, speed_first → 요청가능 우선)
  const sortedAnalysis = useMemo(() => {
    if (!result?.productAnalysis) return [];
    const arr = [...result.productAnalysis];
    if (activeScenario === "cost_first") {
      arr.sort((a, b) => {
        const pa = parseInt(a.estimatedPrice.replace(/[^\d]/g, "")) || Infinity;
        const pb = parseInt(b.estimatedPrice.replace(/[^\d]/g, "")) || Infinity;
        return pa - pb;
      });
    } else if (activeScenario === "speed_first") {
      const order = { "요청 가능": 0, "보류": 1, "제외": 2 };
      arr.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    }
    return arr;
  }, [result?.productAnalysis, activeScenario]);

  // 활성 시나리오의 추천 제품 (요청 가능만)
  const recommendedIds = useMemo(() => {
    return sortedAnalysis
      .filter((pa) => pa.status === "요청 가능")
      .map((pa) => pa.productId);
  }, [sortedAnalysis]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white border-slate-200 p-0 gap-0 z-[60] max-md:max-w-[calc(100vw-2rem)] max-md:mx-4">
        {/* ═══ Header ═══ */}
        <div className="px-5 pt-5 pb-4 md:px-7 md:pt-6 md:pb-5 border-b border-slate-100">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3">
            <span>소싱</span>
            <ChevronRight className="h-2.5 w-2.5" />
            <span>비교 검토</span>
            <ChevronRight className="h-2.5 w-2.5" />
            <span className="text-blue-600 font-medium">AI 분석</span>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg md:text-xl text-slate-900">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              AI 비교 분석 리포트
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[13px] mt-1">
              선택된 후보 <span className="font-semibold text-blue-600">{compareProducts.length}개</span> 제품의 종합 분석
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ═══ Body ═══ */}
        <div className="px-5 py-6 md:px-7 md:py-8 space-y-8 max-h-[62vh] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-blue-500 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">AI가 제품을 분석하고 있습니다</p>
                <p className="text-xs text-slate-400 mt-1">잠시만 기다려 주세요...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-600">{error}</p>
                <p className="text-xs text-slate-400 mt-1">네트워크 상태를 확인해 주세요.</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchAnalysis} className="gap-1.5 mt-1">
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </Button>
            </div>
          )}

          {/* ═══ Result ═══ */}
          {result && !loading && (
            <>
              {/* ── AI 종합 의견 ── */}
              <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">AI 종합 의견</h3>
                </div>
                <p className="text-[13px] md:text-sm text-slate-600 leading-[1.75]">
                  {formatAiSummary(result.aiSummary, productNames)}
                </p>
              </div>

              {/* ── 상세 비교 카드 ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">상세 비교</h3>
                  <span className="text-[11px] text-slate-400">{sortedAnalysis.length}개 제품</span>
                </div>

                {/* 모바일: 가로 스와이프 / 데스크톱: 그리드 */}
                <div className="max-md:flex max-md:gap-3 max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:pb-2 max-md:-mx-5 max-md:px-5 md:grid md:grid-cols-2 md:gap-4">
                  {sortedAnalysis.map((pa) => {
                    const product = compareProducts.find((p) => p.id === pa.productId);
                    const sc = statusConfig(pa.status);
                    const StatusIcon = sc.icon;
                    const isRecommended = recommendedIds[0] === pa.productId && activeScenario;
                    const historyHint = getHistoricalHint(pa.productId, product?.brand);

                    return (
                      <div
                        key={pa.productId}
                        className={`max-md:min-w-[280px] max-md:snap-start rounded-2xl border bg-white p-4 md:p-5 transition-all ${
                          isRecommended
                            ? "border-blue-200 ring-1 ring-blue-100 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        {/* 상단: 제품 정보 + 상태 배지 */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {product?.name ?? pa.productId}
                              </h4>
                              {isRecommended && (
                                <span className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  AI 추천
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {product?.brand ?? ""} · Cat. {product?.catalogNumber ?? "N/A"}
                            </p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${sc.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {pa.status}
                          </span>
                        </div>

                        {/* 가격·납기 2행 */}
                        <div className="space-y-2.5 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">예상 단가</span>
                            <span className="text-base font-bold text-slate-900 tabular-nums">
                              {pa.estimatedPrice}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">예상 납기</span>
                            <span className={`text-sm font-medium tabular-nums ${
                              pa.estimatedDelivery.includes("확인") ? "text-amber-600" : "text-slate-700"
                            }`}>
                              {pa.estimatedDelivery}
                            </span>
                          </div>
                        </div>

                        {/* 과거 구매 이력 힌트 (고도화 #3) */}
                        {historyHint && (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 mb-3">
                            <History className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-500">{historyHint}</span>
                          </div>
                        )}

                        {/* 분석 코멘트 */}
                        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                          {pa.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── AI 추천 전략 (시나리오 칩) ── */}
              {result.scenarios.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-slate-800">AI 추천 전략</h3>
                    <span className="text-[11px] text-slate-400">클릭하여 정렬 기준 변경</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.scenarios.map((s) => {
                      const meta = scenarioMeta[s.type] ?? { icon: Sparkles, label: s.title, shortLabel: s.title };
                      const Icon = meta.icon;
                      const isActive = activeScenario === s.type;
                      return (
                        <button
                          key={s.type}
                          onClick={() => setActiveScenario(isActive ? null : s.type)}
                          className={`group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                            isActive
                              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                              : "bg-white text-slate-700 border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? "text-blue-100" : "text-slate-400 group-hover:text-blue-500"}`} />
                          <span className="max-md:hidden">{meta.label}</span>
                          <span className="md:hidden">{meta.shortLabel}</span>
                          {s.isRecommended && !isActive && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 absolute -top-0.5 -right-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* 선택된 시나리오 설명 */}
                  {activeScenario && (
                    <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {result.scenarios.find((s) => s.type === activeScenario)?.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <div className="px-5 py-4 md:px-7 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-b-lg gap-3">
          <p className="text-[11px] text-slate-400 max-md:hidden">
            AI 분석 결과는 참고용이며, 정확한 조건은 견적 요청을 통해 확인하세요.
          </p>
          <div className="flex items-center gap-2 max-md:w-full">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-500 max-md:flex-1">
              닫기
            </Button>
            {onOpenRequestWizard && result && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm max-md:flex-[2]"
                onClick={handleOpenRequestWizard}
              >
                견적 요청 조립하기
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
