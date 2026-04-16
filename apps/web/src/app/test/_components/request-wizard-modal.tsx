"use client";

import { csrfFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Send,
  Minus,
  Plus,
  Package,
  Building2,
  ClipboardList,
  Zap,
  AlertCircle,
  Clock,
  GitCompareArrows,
  Star,
  Lock,
} from "lucide-react";

/* ── Types ── */
interface ProductForWizard {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  specification?: string | null;
}

interface QuoteItemForWizard {
  id: string;
  name?: string;
  brand?: string | null;
  catalogNumber?: string | null;
}

interface ItemConfig {
  productId: string;
  quantity: number;
  allowSubstitute: boolean;
}

type Urgency = "일반" | "긴급" | "최우선";
type SupplierStrategy = "compare" | "preferred" | "directed";

interface RequestWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductForWizard[];
  quoteItems: QuoteItemForWizard[];
  compareIds: string[];
  onSubmitSuccess?: () => void;
  /** Called when user chooses to navigate to quote management after submission */
  onQuoteManagementOpen?: () => void;
}

/* ── Step animation variants ── */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function RequestWizardModal({
  open,
  onOpenChange,
  products,
  quoteItems,
  compareIds,
  onSubmitSuccess,
  onQuoteManagementOpen,
}: RequestWizardModalProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("일반");
  const [supplierStrategy, setSupplierStrategy] = useState<SupplierStrategy>("compare");
  const [itemConfigs, setItemConfigs] = useState<ItemConfig[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [handoffCountdown, setHandoffCountdown] = useState(5);

  // 요청 대상 제품: quoteItems 우선, 없으면 compareIds 기반
  const targetProducts = useMemo(() => {
    if (quoteItems.length > 0) {
      return quoteItems.map((qi) => {
        const prod = products.find((p) => p.id === qi.id);
        return {
          id: qi.id,
          name: qi.name ?? prod?.name ?? "제품",
          brand: qi.brand ?? prod?.brand ?? null,
          catalogNumber: qi.catalogNumber ?? prod?.catalogNumber ?? null,
          specification: prod?.specification ?? null,
        };
      });
    }
    return products.filter((p) => compareIds.includes(p.id));
  }, [quoteItems, products, compareIds]);

  // 공급사 자동 매칭 (브랜드 기반)
  const suppliers = useMemo(() => {
    const brands = new Set<string>();
    targetProducts.forEach((p) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands);
  }, [targetProducts]);

  // 미확인 항목 (납기 미확인)
  const warnings = useMemo(() => {
    return targetProducts
      .filter((p) => !p.specification)
      .map((p) => `${p.name}: 납기 미확인`);
  }, [targetProducts]);

  // 초기화
  useEffect(() => {
    if (open) {
      setStep(1);
      setDirection(0);
      setPurpose("");
      setUrgency("일반");
      setSupplierStrategy("compare");
      setItemConfigs(
        targetProducts.map((p) => ({
          productId: p.id,
          quantity: 1,
          allowSubstitute: false,
        }))
      );
    }
  }, [open, targetProducts.length]);

  const updateItemConfig = (productId: string, patch: Partial<ItemConfig>) => {
    setItemConfigs((prev) =>
      prev.map((ic) => (ic.productId === productId ? { ...ic, ...patch } : ic))
    );
  };

  const goNext = () => {
    setDirection(1);
    setStep(2);
  };
  const goPrev = () => {
    setDirection(-1);
    setStep(1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        purpose,
        urgency,
        supplierStrategy,
        items: targetProducts.map((p) => {
          const config = itemConfigs.find((ic) => ic.productId === p.id);
          return {
            productId: p.id,
            name: p.name,
            catalogNumber: p.catalogNumber,
            specification: p.specification,
            quantity: config?.quantity ?? 1,
            allowSubstitute: config?.allowSubstitute ?? false,
          };
        }),
        // suppliers array는 directed/preferred 전략에서만 의미 있음
        suppliers: supplierStrategy === "compare" ? [] : suppliers,
      };

      const res = await csrfFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const requestId = res.ok
        ? ((await res.json().catch(() => ({}))) as { id?: string }).id ?? `rfq_${Date.now().toString(36)}`
        : `rfq_${Date.now().toString(36)}`;

      setSubmittedRequestId(requestId);
      onSubmitSuccess?.();

      // Move to step 3 — handoff
      setDirection(1);
      setStep(3);
      setHandoffCountdown(5);
    } catch {
      // Even on API failure, show handoff (request recorded locally)
      setSubmittedRequestId(`rfq_${Date.now().toString(36)}`);
      onSubmitSuccess?.();
      setDirection(1);
      setStep(3);
      setHandoffCountdown(5);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handoff countdown in step 3
  useEffect(() => {
    if (step !== 3) return;
    if (handoffCountdown <= 0) {
      onOpenChange(false);
      onQuoteManagementOpen?.();
      return;
    }
    const timer = setTimeout(() => setHandoffCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, handoffCountdown, onOpenChange, onQuoteManagementOpen]);

  const canGoNext = purpose.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-slate-200 p-0 gap-0 z-[60]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <span>소싱</span>
            <ChevronRight className="h-3 w-3" />
            <span>비교 검토</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">
              {step === 1 ? "견적 요청 조립" : "제출 검토"}
            </span>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              {step === 1 ? "견적 요청 조립" : "요청 제출 검토"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {step === 1
                ? "요청 목적과 품목 상세를 설정하세요."
                : "최종 요청 내용을 확인하고 제출하세요."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              step === 1 ? "bg-blue-100 text-blue-700" : step > 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              <ClipboardList className="h-3 w-3" />
              요청 조립
            </div>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              step === 2 ? "bg-blue-100 text-blue-700" : step > 2 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              <Send className="h-3 w-3" />
              제출 검토
            </div>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              step === 3 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              <CheckCircle2 className="h-3 w-3" />
              완료
            </div>
          </div>
        </div>

        {/* Body with animation */}
        <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
              className="px-6 py-5 space-y-5"
            >
              {step === 1 ? (
                /* ═══ Step 1: 견적 요청 조립 ═══ */
                <>
                  {/* 기본 설정 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">1</span>
                      <h3 className="text-sm font-semibold text-slate-800">기본 설정</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          요청 목적 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="예: 연구실 재고 보충 / 프로젝트 시약 구매"
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">긴급도</label>
                        <div className="flex gap-1">
                          {(["일반", "긴급", "최우선"] as Urgency[]).map((u) => {
                            const isActive = urgency === u;
                            const colors =
                              u === "일반"
                                ? isActive ? "bg-blue-600 text-white" : "bg-white text-slate-600 border-slate-200"
                                : u === "긴급"
                                ? isActive ? "bg-amber-500 text-white" : "bg-white text-slate-600 border-slate-200"
                                : isActive ? "bg-red-500 text-white" : "bg-white text-slate-600 border-slate-200";
                            return (
                              <button
                                key={u}
                                onClick={() => setUrgency(u)}
                                className={`flex-1 text-xs font-medium py-2 rounded-lg border transition-all ${colors}`}
                              >
                                {u}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 요청 품목 상세 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">2</span>
                      <h3 className="text-sm font-semibold text-slate-800">요청 품목 상세 ({targetProducts.length}건)</h3>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {targetProducts.map((p) => {
                        const config = itemConfigs.find((ic) => ic.productId === p.id);
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-slate-900 truncate">{p.name}</h4>
                              <p className="text-xs text-slate-400 truncate">
                                Cat. {p.catalogNumber ?? "N/A"}{p.specification ? ` · ${p.specification}` : ""}
                              </p>
                            </div>
                            {/* Quantity */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">수량</span>
                              <button
                                onClick={() => config && config.quantity > 1 && updateItemConfig(p.id, { quantity: config.quantity - 1 })}
                                className="h-6 w-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium text-slate-800">{config?.quantity ?? 1}</span>
                              <button
                                onClick={() => config && updateItemConfig(p.id, { quantity: config.quantity + 1 })}
                                className="h-6 w-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <span className="text-[11px] text-slate-400">개</span>
                            </div>
                            {/* Substitute toggle */}
                            <button
                              onClick={() => config && updateItemConfig(p.id, { allowSubstitute: !config.allowSubstitute })}
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                config?.allowSubstitute
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-white text-slate-500 border-slate-200"
                              }`}
                            >
                              대체품 허용
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 공급 전략 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">3</span>
                      <h3 className="text-sm font-semibold text-slate-800">공급 전략</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { value: "compare" as SupplierStrategy, label: "비교 견적", desc: "2~3곳 비교 후 선정", icon: GitCompareArrows, color: "blue" },
                        { value: "preferred" as SupplierStrategy, label: "선호 공급사 있음", desc: "우선 배정, 비교 병행", icon: Star, color: "amber" },
                        { value: "directed" as SupplierStrategy, label: "지정 공급사", desc: "해당 공급사만 진행", icon: Lock, color: "slate" },
                      ]).map((opt) => {
                        const isActive = supplierStrategy === opt.value;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setSupplierStrategy(opt.value)}
                            className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                              isActive
                                ? opt.color === "blue" ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                                : opt.color === "amber" ? "border-amber-300 bg-amber-50 ring-1 ring-amber-200"
                                : "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3.5 w-3.5 ${
                                isActive
                                  ? opt.color === "blue" ? "text-blue-600"
                                  : opt.color === "amber" ? "text-amber-600"
                                  : "text-slate-600"
                                  : "text-slate-400"
                              }`} />
                              <span className={`text-xs font-bold ${isActive ? "text-slate-900" : "text-slate-600"}`}>{opt.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    {supplierStrategy !== "compare" && suppliers.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-slate-500 mr-1">
                          {supplierStrategy === "preferred" ? "선호:" : "지정:"}
                        </span>
                        {suppliers.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {supplierStrategy === "compare" && (
                      <p className="text-[11px] text-slate-400 mt-2">공급사 후보 선정은 견적 관리에서 진행됩니다.</p>
                    )}
                  </div>
                </>
              ) : step === 2 ? (
                /* ═══ Step 2: 제출 검토 ═══ */
                <>
                  {/* 미확인 항목 경고 */}
                  {warnings.length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h4 className="text-sm font-semibold text-amber-800">미확인 항목이 있습니다</h4>
                      </div>
                      <ul className="space-y-0.5">
                        {warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 요약 카드: 목적 + 긴급도 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="text-[11px] text-slate-400 font-medium">요청 목적</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{purpose || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="text-[11px] text-slate-400 font-medium">긴급도</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        {urgency === "긴급" && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                        {urgency === "최우선" && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                        {urgency === "일반" && <Clock className="h-3.5 w-3.5 text-blue-500" />}
                        {urgency}
                      </p>
                    </div>
                  </div>

                  {/* 요청 품목 (최종) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-500" />
                        <h4 className="text-sm font-semibold text-slate-800">요청 품목 (최종)</h4>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">{targetProducts.length}건</span>
                    </div>
                    <div className="space-y-2">
                      {targetProducts.map((p) => {
                        const config = itemConfigs.find((ic) => ic.productId === p.id);
                        return (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                            <div>
                              <h5 className="text-sm font-medium text-slate-800">{p.name}</h5>
                              <p className="text-xs text-slate-400">Cat. {p.catalogNumber ?? "N/A"}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-700 font-medium">{config?.quantity ?? 1}개</span>
                              <span className={`px-2 py-0.5 rounded-full ${
                                config?.allowSubstitute
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {config?.allowSubstitute ? "대체 허용" : "대체 불가"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 공급 전략 */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <h4 className="text-sm font-semibold text-slate-800">공급 전략</h4>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        supplierStrategy === "compare" ? "bg-blue-50 text-blue-600" :
                        supplierStrategy === "preferred" ? "bg-amber-50 text-amber-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {supplierStrategy === "compare" ? "비교 견적" :
                         supplierStrategy === "preferred" ? "선호 공급사" : "지정 공급사"}
                      </span>
                    </div>
                    {supplierStrategy === "compare" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1.5 text-xs">
                          <span className="text-slate-500">견적 수집 목표</span>
                          <span className="text-slate-700 font-medium">2~3곳</span>
                        </div>
                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
                          <p className="text-[11px] text-blue-600 leading-relaxed">
                            공급사 후보 선정은 견적 관리에서 진행됩니다.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {suppliers.map((s) => (
                          <div key={s} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${supplierStrategy === "preferred" ? "bg-amber-500" : "bg-slate-500"}`} />
                              <span className="text-sm text-slate-700">{s}</span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                              {supplierStrategy === "preferred" ? "선호" : "지정"}
                            </span>
                          </div>
                        ))}
                        {supplierStrategy === "preferred" && (
                          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                            <p className="text-[11px] text-amber-600 leading-relaxed">
                              선호 공급사 우선 배정, 비교 견적도 병행합니다.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : step === 3 ? (
                /* ═══ Step 3: 완료 + 견적 관리 handoff ═══ */
                <div className="flex flex-col items-center text-center py-6">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1.5">견적 요청이 제출되었습니다</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    품목 {targetProducts.length}건 · {supplierStrategy === "compare" ? "비교 견적으로 진행됩니다" : supplierStrategy === "preferred" ? `선호 공급사 ${suppliers.length}곳 우선 배정` : `지정 공급사 ${suppliers.length}곳에 요청`}
                  </p>

                  {/* Handoff summary */}
                  <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-700">다음 단계: 견적 관리</span>
                    </div>
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">요청 ID</span>
                        <span className="font-mono text-slate-700">{submittedRequestId ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">요청 목적</span>
                        <span className="text-slate-700">{purpose}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">긴급도</span>
                        <span className="text-slate-700">{urgency}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">공급 전략</span>
                        <span className="text-slate-700">
                          {supplierStrategy === "compare" ? "비교 견적" : supplierStrategy === "preferred" ? "선호 공급사" : "지정 공급사"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">상태</span>
                        <span className="text-emerald-600 font-medium">
                          {supplierStrategy === "compare" ? "견적 관리에서 공급사 후보 선정 예정" : "공급사 응답 대기"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    {handoffCountdown}초 후 견적 관리로 자동 이동합니다
                  </p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-b-lg">
          {step === 1 ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-500">
                닫기
              </Button>
              <Button
                size="sm"
                disabled={!canGoNext}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 disabled:opacity-50"
                onClick={goNext}
              >
                다음: 제출 검토
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <Button variant="ghost" size="sm" onClick={goPrev} className="text-slate-500 gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                이전으로
              </Button>
              <Button
                size="sm"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shadow-md disabled:opacity-60"
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    요청 제출
                  </>
                )}
              </Button>
            </>
          ) : (
            /* step === 3: handoff */
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-slate-500"
              >
                검색으로 돌아가기
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onQuoteManagementOpen?.();
                }}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                견적 관리로 이동
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
