"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import {
  BarChart3,
  Upload,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ClipboardPaste,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Trophy,
  Clock,
  DollarSign,
  TrendingDown,
  Package,
  Star,
  Zap,
  AlertTriangle,
  History,
  BookOpen,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CenterWorkWindow, type WorkWindowPhase } from "@/components/work-window/center-work-window";
import { MultiVendorRequestWorkbench } from "@/components/sourcing/multi-vendor-request-workbench";
import {
  buildQuoteComparisonHandoff,
  selectVendorInHandoff,
  canHandoffToRequestAssembly,
  executeHandoffToRequest,
  buildBomParseHandoff,
  confirmBomItems,
  canRegisterToQueue,
  executeRegisterToQueue,
  type QuoteComparisonHandoff,
  type BomParseHandoff,
} from "@/lib/ai/smart-sourcing-handoff-engine";
import {
  buildMultiVendorContextHash,
  buildBomParseContextHash,
  isResultStale,
} from "@/lib/ai/smart-sourcing-context-hash";
import { useSmartSourcingStore } from "@/lib/store/smart-sourcing-store";
import type { VendorQuoteInput, ComparisonResult, BomParseResult, BomItem } from "@/lib/store/smart-sourcing-store";
import { useFastTrackStore } from "@/lib/store/fast-track-store";
import type { FastTrackEvaluationInput } from "@/lib/ontology/fast-track/fast-track-engine";
import {
  QuoteChainProgressStrip,
  buildSmartSourcingStripProps,
  type SmartSourcingHandoffStatus,
} from "@/components/approval/quote-chain-progress-strip";
import {
  emitComparisonCompleted,
  emitVendorSelected,
  emitComparisonHandedOff,
  emitBomParsed,
  emitBomRegisteredToQueue,
} from "@/lib/ai/smart-sourcing-invalidation";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  REAGENT: { label: "시약", color: "bg-blue-50 text-blue-700 border-blue-200" },
  CONSUMABLE: { label: "소모품", color: "bg-amber-50 text-amber-700 border-amber-200" },
  EQUIPMENT: { label: "장비", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

// ═══════════════════════════════════════════════════════════════
// Multi-Vendor Analysis Tab
// ═══════════════════════════════════════════════════════════════

function MultiVendorTab() {
  // G. Zustand store — 핵심 상태를 store에서 관리
  const {
    vendors, productName, quantity, isAnalyzing, comparisonResult: result,
    comparisonHandoff: handoff, resultContextHash,
    setVendors, setProductName, setQuantity, setIsAnalyzing,
    setComparisonResult: setResult, setComparisonHandoff: setHandoff,
    setResultContextHash, addVendor: storeAddVendor,
    removeVendor: storeRemoveVendor, updateVendor: storeUpdateVendor,
  } = useSmartSourcingStore();

  // 로컬 UI 상태 (persist 불필요)
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  // D. Work Window
  const [workWindowOpen, setWorkWindowOpen] = useState(false);
  const [workWindowPhase, setWorkWindowPhase] = useState<WorkWindowPhase>("ready");
  // D-2. Request workbench (production wiring) — handed_off_to_request 상태에서 마운트
  const [requestWorkbenchOpen, setRequestWorkbenchOpen] = useState(false);

  const currentContextHash = useMemo(
    () => buildMultiVendorContextHash({ productName, quantity, vendors }),
    [productName, quantity, vendors]
  );
  const resultIsStale = isResultStale(resultContextHash, currentContextHash);

  const addVendor = () => {
    if (vendors.length >= 5) {
      toast.error("최대 5개 공급사까지 비교 가능합니다.");
      return;
    }
    storeAddVendor({ id: generateId(), vendorName: "", rawText: "" });
  };

  const removeVendor = (id: string) => {
    if (vendors.length <= 2) {
      toast.error("최소 2개 공급사가 필요합니다.");
      return;
    }
    storeRemoveVendor(id);
  };

  const updateVendor = (id: string, field: keyof VendorQuoteInput, value: string) => {
    storeUpdateVendor(id, field, value);
  };

  const handleAnalyze = useCallback(async () => {
    const filledVendors = vendors.filter((v) => v.vendorName.trim() && v.rawText.trim());
    if (filledVendors.length < 2) {
      toast.error("최소 2개 공급사의 견적 데이터를 입력해주세요.");
      return;
    }

    // E. 중복 호출 방지 — 같은 입력이면 기존 결과 재사용
    if (result && !resultIsStale) {
      setWorkWindowOpen(true);
      toast.info("동일 입력에 대한 분석 결과가 이미 있습니다.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setWorkWindowPhase("loading");

    try {
      const res = await fetch("/api/ai/quote-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotes: filledVendors.map((v) => ({
            vendor: v.vendorName,
            items: productName || "견적 품목",
            rawText: v.rawText,
          })),
        }),
      });

      if (!res.ok) throw new Error("API 요청 실패");
      const json = await res.json();

      if (json.success && json.data) {
        setResult(json.data);
        // Handoff 객체 생성
        const h = buildQuoteComparisonHandoff(
          productName || "비교 품목",
          quantity ? parseInt(quantity) : null,
          json.data.comparison || [],
          json.data.recommendation || "",
          json.data.negotiationGuide || "",
        );
        setHandoff(h);
        // I. Invalidation 이벤트 발행
        emitComparisonCompleted(h.id, json.data.comparison?.length ?? 0);
        // E. Context Hash 저장
        setResultContextHash(currentContextHash);
        // D. Work Window 열기
        setWorkWindowPhase("ready");
        setWorkWindowOpen(true);
        toast.success("견적 비교 분석이 완료되었습니다.");
      } else {
        throw new Error(json.error || "분석 실패");
      }
    } catch (err) {
      setWorkWindowPhase("error");
      toast.error("견적 비교 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [vendors, productName, result, resultIsStale, currentContextHash, setIsAnalyzing, setResult, setHandoff, setResultContextHash]);

  // 결과에서 최저가/최빠른 납기 식별
  const cheapest =
    result?.comparison?.length
      ? [...result.comparison].sort(
          (a, b) => (typeof a.price === "number" ? a.price : Infinity) - (typeof b.price === "number" ? b.price : Infinity)
        )[0]?.vendor
      : null;

  const fastest =
    result?.comparison?.length
      ? [...result.comparison].sort((a, b) => {
          const parseDays = (s: string) => {
            const n = parseInt(String(s).replace(/[^0-9]/g, ""));
            return isNaN(n) ? 9999 : n;
          };
          return parseDays(a.leadTime) - parseDays(b.leadTime);
        })[0]?.vendor
      : null;

  return (
    <div className="space-y-5">
      {/* 제품 정보 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500" />
          비교 대상 제품
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">제품명</label>
            <Input
              placeholder="예: Anti-p53 Antibody (DO-1)"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">수량</label>
            <Input
              placeholder="예: 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* 공급사 견적 입력 카드 */}
      <div className="space-y-3">
        {vendors.map((v, idx) => (
          <div
            key={v.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
              onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex-shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <Input
                  placeholder={`공급사 ${idx + 1} 이름`}
                  value={v.vendorName}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateVendor(v.id, "vendorName", e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-40 sm:w-56"
                />
                {v.rawText.trim() && (
                  <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-600">
                    입력완료
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {vendors.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVendor(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {expandedVendor === v.id ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            {(expandedVendor === v.id || !v.rawText.trim()) && (
              <div className="px-4 pb-4 border-t border-slate-100">
                <label className="block text-xs text-slate-500 mt-3 mb-1.5">
                  견적서 텍스트 (PDF에서 복사 또는 직접 입력)
                </label>
                <Textarea
                  placeholder={`공급사 ${String.fromCharCode(65 + idx)}의 견적 내용을 붙여넣으세요...\n예: 단가 45,000원, 납기 2주, 배송비 3,000원`}
                  value={v.rawText}
                  onChange={(e) => updateVendor(v.id, "rawText", e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 공급사 추가 + 분석 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addVendor} className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          공급사 추가
        </Button>
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              AI 견적 비교 분석
            </>
          )}
        </Button>
      </div>

      {/* E. Staleness 경고 */}
      {result && resultIsStale && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs mt-4">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>입력이 변경되었습니다. 분석 결과가 현재 입력과 다를 수 있습니다.</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-amber-700 hover:text-amber-900 h-6 px-2"
            onClick={handleAnalyze}
          >
            재분석
          </Button>
        </div>
      )}

      {/* D. 결과 있으면 Work Window 열기 버튼 */}
      {result && !workWindowOpen && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => { setWorkWindowPhase("ready"); setWorkWindowOpen(true); }}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            분석 결과 보기
          </Button>
        </div>
      )}

      {/* D. CenterWorkWindow — 분석 결과 모달 */}
      <CenterWorkWindow
        open={workWindowOpen}
        onClose={() => setWorkWindowOpen(false)}
        title="견적 비교 분석 결과"
        subtitle={productName ? `${productName} · ${vendors.filter((v) => v.vendorName.trim()).length}개 공급사` : undefined}
        phase={workWindowPhase}
        successMessage="견적 요청으로 전달되었습니다"
        autoCloseDelay={0}
        contextHeader={
          handoff && handoff.status !== "comparison_complete" ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {handoff.status === "vendor_selected" ? `${handoff.selectedVendorName} 선정됨` : "견적 요청 전달 완료"}
            </div>
          ) : undefined
        }
      >

      {/* ── 분석 결과 (Work Window 내부) ── */}
      {result && (
        <div className="space-y-4">
          {/* H. ProgressStrip — handoff 상태 시각화 */}
          {handoff && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 overflow-x-auto">
              <QuoteChainProgressStrip
                {...buildSmartSourcingStripProps(handoff.status as SmartSourcingHandoffStatus)}
                compact={false}
              />
            </div>
          )}
          {/* F. center/rail 레이아웃 */}
          <div className="flex flex-col lg:flex-row gap-4">
          {/* ── CENTER: 비교 테이블 + 추천 + handoff ── */}
          <div className="flex-1 min-w-0 space-y-4">

          {/* 비교 테이블 */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                비교 결과
              </h3>
            </div>

            {/* 모바일: 카드형 / 데스크탑: 테이블 */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-xs">
                    <th className="text-left px-4 py-2.5 font-medium">공급사</th>
                    <th className="text-right px-4 py-2.5 font-medium">단가</th>
                    <th className="text-center px-4 py-2.5 font-medium">납기</th>
                    <th className="text-right px-4 py-2.5 font-medium">배송비</th>
                    <th className="text-center px-4 py-2.5 font-medium">평가</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparison.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-t border-slate-100 transition-colors",
                        row.vendor === cheapest && "bg-emerald-50/40"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.vendor}
                        {row.vendor === cheapest && (
                          <Badge className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                            <Trophy className="h-2.5 w-2.5 mr-0.5" />
                            최저가
                          </Badge>
                        )}
                        {row.vendor === fastest && row.vendor !== cheapest && (
                          <Badge className="ml-2 text-[9px] bg-sky-100 text-sky-700 border-sky-200">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            최단납기
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {typeof row.price === "number"
                          ? `${row.price.toLocaleString()}원`
                          : row.price}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{row.leadTime}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {typeof row.shippingFee === "number"
                          ? `${row.shippingFee.toLocaleString()}원`
                          : row.shippingFee}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.vendor === cheapest ? (
                          <Star className="h-4 w-4 text-amber-400 mx-auto fill-amber-400" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="md:hidden divide-y divide-slate-100">
              {result.comparison.map((row, i) => (
                <div key={i} className={cn("p-4", row.vendor === cheapest && "bg-emerald-50/40")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800 text-sm">{row.vendor}</span>
                    <div className="flex gap-1">
                      {row.vendor === cheapest && (
                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">최저가</Badge>
                      )}
                      {row.vendor === fastest && row.vendor !== cheapest && (
                        <Badge className="text-[9px] bg-sky-100 text-sky-700 border-sky-200">최단납기</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">단가</span>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {typeof row.price === "number" ? `${row.price.toLocaleString()}원` : row.price}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">납기</span>
                      <p className="font-medium text-slate-600 mt-0.5">{row.leadTime}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">배송비</span>
                      <p className="font-medium text-slate-600 mt-0.5">
                        {typeof row.shippingFee === "number" ? `${row.shippingFee.toLocaleString()}원` : row.shippingFee}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Handoff: 공급사 선정 → 견적 요청 (DOCK 역할) ── */}
          {handoff && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-violet-500" />
                다음 단계: 공급사 선정
              </h4>

              {handoff.status === "handed_off_to_request" ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    <strong>{handoff.selectedVendorName}</strong> 공급사로 견적 요청이 전달되었습니다.
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {result.comparison.map((row, i) => {
                      const isSelected = handoff.selectedVendorName === row.vendor;
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            try {
                              const updated = selectVendorInHandoff(handoff, row.vendor, `비교 분석 기반 선정: ${row.vendor}`);
                              setHandoff(updated);
                              // I. Invalidation 이벤트 발행
                              emitVendorSelected(handoff.id, row.vendor);
                            } catch (err) {
                              toast.error(String(err));
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all text-left",
                            "active:scale-[0.98]",
                            isSelected
                              ? "border-violet-300 bg-violet-50 text-violet-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          <span className="font-medium">{row.vendor}</span>
                          <span className="text-xs text-slate-400">
                            {typeof row.price === "number" ? `${row.price.toLocaleString()}원` : row.price}
                            {" · "}{row.leadTime}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const check = canHandoffToRequestAssembly(handoff);
                    return (
                      <div className="flex items-center justify-between">
                        {check.blockers.length > 0 && (
                          <p className="text-xs text-slate-400">{check.blockers[0]}</p>
                        )}
                        <Button
                          size="sm"
                          disabled={!check.canHandoff}
                          onClick={() => {
                            try {
                              const executed = executeHandoffToRequest(handoff);
                              setHandoff(executed);
                              // I. Invalidation 이벤트 발행
                              emitComparisonHandedOff(executed.id, executed.selectedVendorName ?? "");
                              // D-2. terminal toast 대신 request workbench 진입
                              setRequestWorkbenchOpen(true);
                            } catch (err) {
                              toast.error(String(err));
                            }
                          }}
                          className="ml-auto bg-violet-600 hover:bg-violet-700 text-white text-xs"
                        >
                          <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                          견적 요청으로 전달
                        </Button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          </div>{/* end CENTER */}

          {/* ── RAIL: 컨텍스트 정보 (가이드/히스토리) ── */}
          <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-3">
            {/* AI 추천 요약 */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3">
              <h4 className="text-xs font-semibold text-blue-800 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                AI 추천
              </h4>
              <p className="text-xs text-blue-900/80 leading-relaxed">{result.recommendation}</p>
            </div>

            {/* 네고 가이드 */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
              <h4 className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                네고 포인트
              </h4>
              <p className="text-xs text-amber-900/80 leading-relaxed whitespace-pre-line">{result.negotiationGuide}</p>
            </div>

            {/* 사용 가이드 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <h4 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                다음 단계
              </h4>
              <ol className="text-xs text-slate-500 space-y-1">
                <li>1. 공급사를 선정하세요</li>
                <li>2. "견적 요청으로 전달"을 누르세요</li>
                <li>3. 견적 요청 조립 단계로 이동합니다</li>
              </ol>
            </div>
          </div>{/* end RAIL */}

          </div>{/* end flex center/rail */}
        </div>
      )}
      </CenterWorkWindow>

      {/* D-2. Production wiring: 견적 요청 조립 → 제출 work window */}
      {handoff && handoff.status === "handed_off_to_request" && (
        <MultiVendorRequestWorkbench
          open={requestWorkbenchOpen}
          onClose={() => setRequestWorkbenchOpen(false)}
          comparisonHandoff={handoff}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOM Auto Sourcing Tab
// ═══════════════════════════════════════════════════════════════

/**
 * BOM item → Fast-Track evaluation input.
 *
 * Queue 진입 직후(Smart Sourcing 등록 성공 시점)에는 공급사/단가가 확정되지
 * 않은 상태이므로, 엔진은 대부분 `not_eligible` 을 반환한다. 그래도 이 시점에
 * evaluateItem 을 한 번 호출해 두면:
 *   1) governance bus 에 최초 "not_eligible" transition 이벤트가 찍혀
 *      drift 재평가의 baseline 이 확보되고,
 *   2) 이후 견적/공급사 확정 시 재평가에서 previous state 비교가 가능하다.
 *
 * procurementCaseId 는 BOM handoff id + line index 로 안정적으로 유도한다.
 * (handoff id 가 없으면 BOM 텍스트 해시 + idx 로 fallback 가능하지만,
 *  현재는 handoff id 가 있을 때만 호출하므로 caller 에서 id 보장.)
 */
function bomItemToFastTrackInput(
  caseIdPrefix: string,
  item: BomItem,
  idx: number,
): FastTrackEvaluationInput {
  const procurementCaseId = `${caseIdPrefix}::${idx}`;
  return {
    procurementCaseId,
    vendorId: "",
    vendorName: "미정",
    totalAmount: 0,
    items: [
      {
        productId: item.catalogNumber ?? `bom-${idx}`,
        productName: item.name,
        category: "reagent" as const,
        safetyProfile: {
          hazardCodes: [],
          pictograms: [],
          ppe: [],
          storageClass: null,
        },
        regulatedFlag: false,
        manualReviewRequired: false,
      },
    ],
    histories: [],
  };
}

function BomSourcingTab() {
  // G. Zustand store — 핵심 상태를 store에서 관리
  const {
    bomText, isParsing, bomResult: result, bomHandoff,
    bomResultHash, selectedBomItems, isRegistering,
    setBomText, setIsParsing, setBomResult: setResult,
    setBomHandoff, setBomResultHash, setSelectedBomItems,
    toggleBomItem, toggleAllBomItems, setIsRegistering,
  } = useSmartSourcingStore();

  // Fast-Track 파이프라인 진입점 — BOM 등록 직후 평가를 트리거한다.
  // canonical truth mutation 은 발생하지 않으며, publisher 가 governance bus
  // 에 not_eligible/eligible transition 이벤트만 발행한다.
  const bulkEvaluateFastTrack = useFastTrackStore((s) => s.bulkEvaluate);

  // Set 인터페이스 호환 (기존 코드와 일관성)
  const selectedItems = useMemo(() => new Set(selectedBomItems), [selectedBomItems]);

  const currentBomHash = useMemo(
    () => buildBomParseContextHash({ bomText }),
    [bomText]
  );
  const bomResultIsStale = isResultStale(bomResultHash, currentBomHash);

  const handleParse = useCallback(async () => {
    if (!bomText.trim()) {
      toast.error("BOM 텍스트를 입력해주세요.");
      return;
    }

    // E. 중복 호출 방지
    if (result && !bomResultIsStale) {
      toast.info("동일 입력에 대한 파싱 결과가 이미 있습니다.");
      return;
    }

    setIsParsing(true);
    setResult(null);
    setSelectedBomItems([]);

    try {
      const res = await fetch("/api/ai/bom-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bomText }),
      });

      if (!res.ok) throw new Error("API 요청 실패");
      const json = await res.json();

      if (json.success && json.data) {
        setResult(json.data);
        // 기본적으로 모두 선택
        setSelectedBomItems(json.data.items.map((_: BomItem, i: number) => i));
        // Handoff 생성
        const h = buildBomParseHandoff(bomText, json.data.items, json.data.summary || "");
        setBomHandoff(h);
        // I. Invalidation 이벤트 발행
        emitBomParsed(h.id, json.data.items.length);
        // E. Context Hash 저장
        setBomResultHash(currentBomHash);
        toast.success(`${json.data.items.length}개 품목이 파싱되었습니다.`);
      } else {
        throw new Error(json.error || "파싱 실패");
      }
    } catch (err) {
      toast.error("BOM 파싱 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  }, [bomText, result, bomResultIsStale, currentBomHash, setIsParsing, setResult, setBomHandoff, setBomResultHash, setSelectedBomItems]);

  const toggleItem = (idx: number) => {
    toggleBomItem(idx);
  };

  const toggleAll = () => {
    toggleAllBomItems();
  };

  const handleBulkRegister = useCallback(async () => {
    if (!result || selectedItems.size === 0) return;

    // Handoff guard 체크
    if (bomHandoff) {
      const confirmed = confirmBomItems(bomHandoff, Array.from(selectedItems));
      const check = canRegisterToQueue(confirmed);
      if (!check.canRegister) {
        toast.error(check.blockers[0]);
        return;
      }
    }

    setIsRegistering(true);
    try {
      const items = Array.from(selectedItems).map((idx: number) => result.items[idx]);

      const res = await fetch("/api/order-queue/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            name: i.name,
            catalogNumber: i.catalogNumber,
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            brand: i.brand,
            estimatedUse: i.estimatedUse,
          })),
          sourceHandoffId: bomHandoff?.id || null,
        }),
      });

      const json = await res.json();

      if (json.success) {
        // G. Handoff 상태 전이 → store에 반영
        if (bomHandoff) {
          const confirmed = confirmBomItems(bomHandoff, Array.from(selectedItems));
          const registered = executeRegisterToQueue(confirmed);
          setBomHandoff(registered);
          // I. Invalidation 이벤트 발행
          emitBomRegisteredToQueue(registered.id, registered.registeredCount ?? 0);
        }

        // ── Fast-Track 파이프라인 진입 훅 ───────────────────────────
        // Queue 등록이 성공한 직후, 방금 등록된 라인들에 대해 Fast-Track
        // baseline 평가를 발행한다. caseId 는 handoff id (없으면 BOM hash)
        // + 라인 인덱스로 결정론적으로 유도한다. Caller 는 결과를 사용하지
        // 않고 publisher 가 bus 에 transition 이벤트를 올리도록 훅만 연결한다.
        try {
          const caseIdPrefix =
            bomHandoff?.id ?? `bom::${currentBomHash ?? "anon"}`;
          const selectedIdx = Array.from(selectedItems);
          const ftInputs: FastTrackEvaluationInput[] = selectedIdx
            .map((idx: number) => {
              const item = result.items[idx];
              if (!item) return null;
              return bomItemToFastTrackInput(caseIdPrefix, item, idx);
            })
            .filter((i): i is FastTrackEvaluationInput => i !== null);
          if (ftInputs.length > 0) {
            bulkEvaluateFastTrack(ftInputs);
          }
        } catch (ftErr) {
          // Fast-Track 평가 실패는 등록 흐름을 막지 않는다.
          console.warn("[smart-sourcing] Fast-Track 초기 평가 실패:", ftErr);
        }

        // 종료 toast 대신 인라인 hub (BomRegisteredReentryHub) 가 다음 작업으로 안내한다.
      } else {
        throw new Error(json.error || "등록 실패");
      }
    } catch (err) {
      toast.error("등록 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  }, [result, selectedItems, bomHandoff, currentBomHash, setIsRegistering, setBomHandoff, bulkEvaluateFastTrack]);

  const EXAMPLE_BOM = `Gibco FBS 500ml 2병
DMEM High Glucose 500ml 3병
Trypsin-EDTA 0.25% 100ml 2개
Falcon 50ml Conical Tube 500개
Anti-beta-actin antibody (AC-15) 1개
Pipette Tips 1000ul 10box
PBS pH 7.4 1L 5병`;

  return (
    <div className="space-y-5">
      {/* BOM 텍스트 입력 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-emerald-500" />
            BOM 텍스트 입력
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setBomText(EXAMPLE_BOM)}
          >
            예시 불러오기
          </Button>
        </div>
        <Textarea
          placeholder="엔지니어가 작성한 부품 리스트(BOM)를 여기에 붙여넣으세요...&#10;&#10;예:&#10;Gibco FBS 500ml 2병&#10;DMEM High Glucose 500ml 3병&#10;Trypsin-EDTA 0.25% 100ml 2개"
          value={bomText}
          onChange={(e) => setBomText(e.target.value)}
          className="min-h-[140px] text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">
            {bomText.trim() ? `${bomText.split("\n").filter((l) => l.trim()).length}줄 입력됨` : "텍스트를 붙여넣거나 직접 입력하세요"}
          </p>
          <Button
            size="sm"
            onClick={handleParse}
            disabled={isParsing || !bomText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                파싱 중...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                AI 품목 파싱
              </>
            )}
          </Button>
        </div>
      </div>

      {/* E. BOM Staleness 경고 */}
      {result && bomResultIsStale && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>텍스트가 변경되었습니다. 파싱 결과가 현재 입력과 다를 수 있습니다.</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-amber-700 hover:text-amber-900 h-6 px-2"
            onClick={handleParse}
          >
            재파싱
          </Button>
        </div>
      )}

      {/* ── 파싱 결과 ── */}
      {result && (
        <div className="space-y-4">
          {/* H. ProgressStrip — BOM handoff 상태 시각화 */}
          {bomHandoff && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 overflow-x-auto">
              <QuoteChainProgressStrip
                {...buildSmartSourcingStripProps(bomHandoff.status as SmartSourcingHandoffStatus)}
                compact={false}
              />
            </div>
          )}
          {/* 요약 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{result.items.length}개</span> 품목 추출됨
              {result.summary && <span className="text-slate-400 ml-2">· {result.summary}</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                {selectedItems.size === result.items.length ? "전체 해제" : "전체 선택"}
              </Button>
            </div>
          </div>

          {/* 품목 리스트 */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {result.items.map((item, idx) => {
              const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.REAGENT;
              const isSelected = selectedItems.has(idx);

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 p-3.5 md:p-4 cursor-pointer transition-colors",
                    isSelected ? "bg-white" : "bg-slate-50/50"
                  )}
                  onClick={() => toggleItem(idx)}
                >
                  {/* 체크박스 */}
                  <div className="mt-0.5 flex-shrink-0">
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                        isSelected
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>

                  {/* 품목 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <Badge variant="outline" className={cn("text-[10px] border", cat.color)}>
                        {cat.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                      {item.catalogNumber && <span>Cat# {item.catalogNumber}</span>}
                      {item.brand && <span>{item.brand}</span>}
                      {item.estimatedUse && <span>{item.estimatedUse}</span>}
                    </div>
                  </div>

                  {/* 수량 */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-700">
                      {item.quantity} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 일괄 등록 / 다음 작업 진입 허브 */}
          {bomHandoff?.status === "registered_to_queue" ? (
            <BomRegisteredReentryHub
              registeredCount={bomHandoff.registeredCount ?? 0}
              handoffId={bomHandoff.id}
            />
          ) : (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                {selectedItems.size}개 품목 선택됨
              </p>
              <Button
                size="sm"
                onClick={handleBulkRegister}
                disabled={isRegistering || selectedItems.size === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    등록 중...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                    발주 대기열에 일괄 등록
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * D-2-bom: BOM 등록 직후 노출되는 "다음 작업 진입 허브".
 *
 * - 종료 success 카드가 아니라 next required action 으로 안내한다.
 * - center=decision (queue 진입), rail=context (등록된 라인 수 / Fast-Track 결과 발행 사실)
 *   세 영역을 이 작은 hub 안에서 축약 형태로 유지한다.
 * - canonical truth 는 OrderQueue 가 보유하므로 이 hub 는 read-only 안내만 한다.
 */
function BomRegisteredReentryHub({
  registeredCount,
  handoffId: _handoffId,
}: {
  registeredCount: number;
  handoffId: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 mt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            발주 대기열 등록 완료 · {registeredCount}건
          </div>
          <p className="mt-1 text-xs text-slate-600">
            다음 작업: 등록된 라인의 가격/공급사/리드타임을 발주 대기열에서 검토해 진행하세요.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Fast-Track 평가는 백그라운드로 발행되어 대기열에서 우선순위/대체 후보로 반영됩니다.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex-shrink-0"
        >
          <Link href="/dashboard/orders">
            발주 대기열 열기
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function SmartSourcingPage() {
  // G. Zustand store — 탭 상태도 store에서 관리
  const { activeTab, setActiveTab } = useSmartSourcingStore();

  const tabs: { key: typeof activeTab; label: string; icon: React.ElementType; desc: string }[] = [
    {
      key: "multi-vendor",
      label: "다중 견적 비교",
      icon: BarChart3,
      desc: "여러 공급사 견적을 AI로 비교·분석",
    },
    {
      key: "bom-sourcing",
      label: "BOM 자동 발주",
      icon: ClipboardPaste,
      desc: "부품 리스트를 파싱하여 일괄 등록",
    },
  ];

  return (
    <div className="w-full max-w-full px-0 py-2 md:py-4 pb-20 lg:pb-6">
      {/* 헤더 */}
      <div className="mb-5 md:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1
            className="text-xl md:text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: "'Inter', 'Pretendard', system-ui, sans-serif" }}
          >
            AI 견적 분석
          </h1>
          <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] font-semibold">
            AI
          </Badge>
        </div>
        <p className="text-xs md:text-sm text-slate-500">
          AI가 견적서를 비교 분석하고, BOM 텍스트에서 품목을 자동 추출하여 발주를 돕습니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-5 md:mb-6 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border",
                "active:scale-[0.97]",
                isActive
                  ? "bg-white text-slate-800 border-slate-200 shadow-sm"
                  : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-700"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-blue-500" : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "multi-vendor" && <MultiVendorTab />}
      {activeTab === "bom-sourcing" && <BomSourcingTab />}
    </div>
  );
}
