"use client";

import { useState, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type Tab = "multi-vendor" | "bom-sourcing";

interface VendorQuoteInput {
  id: string;
  vendorName: string;
  rawText: string;
}

interface ComparisonVendor {
  vendor: string;
  price: number | string;
  leadTime: string;
  shippingFee: number | string;
}

interface ComparisonResult {
  comparison: ComparisonVendor[];
  recommendation: string;
  negotiationGuide: string;
}

interface BomItem {
  name: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string;
  category: string;
  estimatedUse: string | null;
  brand: string | null;
}

interface BomParseResult {
  items: BomItem[];
  summary: string;
}

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
  const [vendors, setVendors] = useState<VendorQuoteInput[]>([
    { id: generateId(), vendorName: "", rawText: "" },
    { id: generateId(), vendorName: "", rawText: "" },
  ]);
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const addVendor = () => {
    if (vendors.length >= 5) {
      toast.error("최대 5개 공급사까지 비교 가능합니다.");
      return;
    }
    setVendors((prev) => [...prev, { id: generateId(), vendorName: "", rawText: "" }]);
  };

  const removeVendor = (id: string) => {
    if (vendors.length <= 2) {
      toast.error("최소 2개 공급사가 필요합니다.");
      return;
    }
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const updateVendor = (id: string, field: keyof VendorQuoteInput, value: string) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const handleAnalyze = useCallback(async () => {
    const filledVendors = vendors.filter((v) => v.vendorName.trim() && v.rawText.trim());
    if (filledVendors.length < 2) {
      toast.error("최소 2개 공급사의 견적 데이터를 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

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
        toast.success("견적 비교 분석이 완료되었습니다.");
      } else {
        throw new Error(json.error || "분석 실패");
      }
    } catch (err) {
      toast.error("견적 비교 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [vendors, productName]);

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

      {/* ── 분석 결과 ── */}
      {result && (
        <div className="space-y-4 mt-6">
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

          {/* AI 추천 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 md:p-5">
            <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              AI 추천
            </h4>
            <p className="text-sm text-blue-900/80 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* 네고 포인트 */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 md:p-5">
            <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              네고 포인트
            </h4>
            <p className="text-sm text-amber-900/80 leading-relaxed whitespace-pre-line">
              {result.negotiationGuide}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOM Auto Sourcing Tab
// ═══════════════════════════════════════════════════════════════

function BomSourcingTab() {
  const [bomText, setBomText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<BomParseResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isRegistering, setIsRegistering] = useState(false);

  const handleParse = useCallback(async () => {
    if (!bomText.trim()) {
      toast.error("BOM 텍스트를 입력해주세요.");
      return;
    }

    setIsParsing(true);
    setResult(null);
    setSelectedItems(new Set());

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
        setSelectedItems(new Set(json.data.items.map((_: BomItem, i: number) => i)));
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
  }, [bomText]);

  const toggleItem = (idx: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selectedItems.size === result.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(result.items.map((_, i) => i)));
    }
  };

  const handleBulkRegister = useCallback(async () => {
    if (!result || selectedItems.size === 0) return;

    setIsRegistering(true);
    try {
      // 선택된 품목들을 발주 대기열에 등록
      const items = Array.from(selectedItems).map((idx) => result.items[idx]);

      // Order Queue 또는 견적 요청으로 전환
      // 실제 환경에서는 POST /api/order-queue/bulk 등으로 연결
      await new Promise((resolve) => setTimeout(resolve, 1200));

      toast.success(`${items.length}개 품목이 발주 대기열에 등록되었습니다.`);
    } catch (err) {
      toast.error("등록 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  }, [result, selectedItems]);

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

      {/* ── 파싱 결과 ── */}
      {result && (
        <div className="space-y-4">
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

          {/* 일괄 등록 버튼 */}
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
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function SmartSourcingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("multi-vendor");

  const tabs: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
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
            스마트 소싱
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
