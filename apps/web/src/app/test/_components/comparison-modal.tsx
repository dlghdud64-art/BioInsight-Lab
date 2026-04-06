"use client";

import { useState, useEffect, useCallback } from "react";
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
const scenarioIcon = (type: string) => {
  switch (type) {
    case "cost_first": return <TrendingDown className="h-4 w-4" />;
    case "balanced": return <Scale className="h-4 w-4" />;
    case "speed_first": return <Zap className="h-4 w-4" />;
    default: return <Sparkles className="h-4 w-4" />;
  }
};

const statusConfig = (status: string) => {
  switch (status) {
    case "요청 가능":
      return { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" };
    case "보류":
      return { icon: <Clock className="h-4 w-4" />, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" };
    case "제외":
      return { icon: <Ban className="h-4 w-4" />, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700" };
    default:
      return { icon: <AlertCircle className="h-4 w-4" />, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-700" };
  }
};

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

  // 비교 대상 제품만 필터
  const compareProducts = products.filter((p) => compareIds.includes(p.id));
  const compareKey = compareIds.slice().sort().join(",");

  const fetchAnalysis = async () => {
    const targets = products.filter((p) => compareIds.includes(p.id));
    if (targets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/compare-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: targets }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "분석 실패");
      setResult(json.data);
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
      fetchAnalysis();
    }
    if (!open) {
      setResult(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compareKey]);

  const handleOpenRequestWizard = () => {
    onOpenChange(false);
    onOpenRequestWizard?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white border-slate-200 p-0 gap-0 z-[60]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <span>소싱</span>
            <ChevronRight className="h-3 w-3" />
            <span>비교 검토</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">AI 비교 분석</span>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5 text-blue-600" />
              </div>
              AI 비교 분석 리포트
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              선택된 후보 <span className="font-semibold text-blue-600">{compareProducts.length}개</span> · 종합 카테고리별 분석 완료
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">AI가 제품을 분석하고 있습니다...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchAnalysis} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </Button>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <>
              {/* AI 종합 의견 */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-800">AI 종합 의견</h3>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{result.aiSummary}</p>
              </div>

              {/* 상세 비교 */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">상세 비교</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.productAnalysis.map((pa) => {
                    const product = compareProducts.find((p) => p.id === pa.productId);
                    const sc = statusConfig(pa.status);
                    return (
                      <div
                        key={pa.productId}
                        className={`rounded-xl border ${sc.border} ${sc.bg} p-4 space-y-3`}
                      >
                        {/* Product info */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                              {product?.name ?? pa.productId}
                            </h4>
                            <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${sc.badge}`}>
                              {sc.icon}
                              {pa.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {product?.brand ?? ""} · Cat. {product?.catalogNumber ?? "N/A"}
                          </p>
                        </div>

                        {/* Price & Delivery */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" /> 예상 단가
                            </span>
                            <span className="font-semibold text-slate-800">{pa.estimatedPrice}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> 예상 납기
                            </span>
                            <span className="font-medium text-slate-700">{pa.estimatedDelivery}</span>
                          </div>
                        </div>

                        {/* Reason */}
                        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200/60 pt-2">
                          {pa.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3 시나리오 */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">소싱 전략 시나리오</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {result.scenarios.map((s) => (
                    <div
                      key={s.type}
                      className={`rounded-xl border p-4 transition-all ${
                        s.isRecommended
                          ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                          s.isRecommended ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                        }`}>
                          {scenarioIcon(s.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-800">{s.title}</h4>
                        </div>
                        {s.isRecommended && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            추천
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-b-lg">
          <p className="text-[11px] text-slate-400">
            AI 분석 결과는 참고용이며, 정확한 조건은 견적 요청을 통해 확인하세요.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-500">
              닫기
            </Button>
            {onOpenRequestWizard && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                onClick={handleOpenRequestWizard}
              >
                견적 요청 조립하기
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
