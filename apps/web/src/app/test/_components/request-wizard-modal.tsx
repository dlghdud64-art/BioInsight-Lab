"use client";

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

interface RequestWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductForWizard[];
  quoteItems: QuoteItemForWizard[];
  compareIds: string[];
  onSubmitSuccess?: () => void;
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
}: RequestWizardModalProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("일반");
  const [itemConfigs, setItemConfigs] = useState<ItemConfig[]>([]);

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

  const handleSubmit = () => {
    // TODO: 실제 API 제출
    onOpenChange(false);
    onSubmitSuccess?.();
  };

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
              step === 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
            }`}>
              <ClipboardList className="h-3 w-3" />
              요청 조립
            </div>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              step === 2 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
            }`}>
              <Send className="h-3 w-3" />
              제출 검토
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

                  {/* 공급사 대상 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">3</span>
                      <h3 className="text-sm font-semibold text-slate-800">공급사 대상 ({suppliers.length}곳)</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suppliers.length > 0 ? (
                        suppliers.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">자동 매칭된 공급사가 없습니다.</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
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

                  {/* 공급사 대상 (최종) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <h4 className="text-sm font-semibold text-slate-800">공급사 대상 (최종)</h4>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">{suppliers.length}곳</span>
                    </div>
                    <div className="space-y-2">
                      {suppliers.map((s) => (
                        <div key={s} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-sm text-slate-700">{s}</span>
                          </div>
                          <span className="text-xs text-emerald-600 font-medium">제출 가능</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
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
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={goPrev} className="text-slate-500 gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                이전으로
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shadow-md"
                onClick={handleSubmit}
              >
                <Send className="h-3.5 w-3.5" />
                요청 제출
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
