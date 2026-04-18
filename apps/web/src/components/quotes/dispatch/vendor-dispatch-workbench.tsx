"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, Mail, Check, AlertTriangle, Building2,
  Sparkles, Pencil, ChevronRight, Shield, Info, ExternalLink,
  ChevronDown, Send, Clock, UserPlus,
} from "lucide-react";

import type { ResolvedSupplier } from "./resolve-suppliers";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface VendorRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId?: string;
  /** AI-resolved supplier candidates from request assembly / compare flow */
  resolvedSuppliers?: ResolvedSupplier[];
  /** Pre-built draft message from request assembly */
  draftMessage?: string;
  /** Quote title / line summary for context display */
  quoteSummary?: string;
  onSuccess?: () => void;
}

type SendReadiness = "ready" | "needs_review" | "blocked";

interface ReadinessCheck {
  key: "supplier" | "contact" | "draft" | "quote";
  label: string;
  ready: boolean;
  blocker?: string;
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

const CONTACT_SOURCE_LABEL: Record<ResolvedSupplier["contactSource"], string> = {
  supplier_book: "공급사 DB",
  recent_rfq: "견적 이력",
  ai_recommended: "AI 추천",
  manual: "수동 입력",
};

const CONTACT_SOURCE_ICON: Record<ResolvedSupplier["contactSource"], string> = {
  supplier_book: "DB",
  recent_rfq: "이력",
  ai_recommended: "AI",
  manual: "수동",
};

const CONFIDENCE_COLOR: Record<ResolvedSupplier["confidence"], string> = {
  high: "text-emerald-400 border-emerald-500/25 bg-emerald-600/10",
  medium: "text-amber-400 border-amber-500/25 bg-amber-600/10",
  low: "text-red-400 border-red-500/25 bg-red-600/10",
};

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════

export function VendorRequestModal({
  open,
  onOpenChange,
  quoteId,
  resolvedSuppliers: resolvedSuppliersInput,
  draftMessage: draftMessageInput,
  quoteSummary,
  onSuccess,
}: VendorRequestModalProps) {
  const { toast } = useToast();
  const router = useRouter();

  // ── State ──
  const [suppliers, setSuppliers] = useState<ResolvedSupplier[]>([]);
  const [message, setMessage] = useState("");
  const [messageEditing, setMessageEditing] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [messageExpanded, setMessageExpanded] = useState(false);

  // ── Initialize from resolved data ──
  useEffect(() => {
    if (!open) return;
    if (resolvedSuppliersInput && resolvedSuppliersInput.length > 0) {
      setSuppliers(resolvedSuppliersInput);
    } else {
      setSuppliers([]);
    }
    setMessage(draftMessageInput || "");
    setMessageEditing(false);
    setShowManualFallback(false);
    setManualEmail("");
    setManualName("");
    setMessageExpanded(false);
  }, [open, resolvedSuppliersInput, draftMessageInput]);

  // ── Derived ──
  const includedSuppliers = suppliers.filter((s) => s.included);
  const excludedSuppliers = suppliers.filter((s) => !s.included);
  const hasResolved = suppliers.length > 0;
  const resolvedCount = suppliers.length;
  const includedCount = includedSuppliers.length;

  // ── Readiness checks ──
  const readinessChecks = useMemo<ReadinessCheck[]>(() => {
    const checks: ReadinessCheck[] = [];

    const supplierOk = includedCount > 0;
    checks.push({
      key: "supplier",
      label: "공급사 후보 선별",
      ready: supplierOk,
      blocker: supplierOk ? undefined : "연락 가능한 공급사 후보가 없습니다",
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const contactOk = includedSuppliers.every((s) => emailRegex.test(s.email));
    checks.push({
      key: "contact",
      label: "연락 채널 확인",
      ready: contactOk,
      blocker: contactOk
        ? undefined
        : `이메일 형식 오류: ${includedSuppliers.filter((s) => !emailRegex.test(s.email)).map((s) => s.vendorName).join(", ")}`,
    });

    const draftOk = message.trim().length > 10;
    checks.push({
      key: "draft",
      label: "전달 메시지 검토",
      ready: draftOk,
      blocker: draftOk ? undefined : "전달 메시지가 준비되지 않았습니다",
    });

    const quoteOk = !!quoteId;
    checks.push({
      key: "quote",
      label: "견적 연결",
      ready: quoteOk,
      blocker: quoteOk ? undefined : "견적을 먼저 저장해주세요",
    });

    return checks;
  }, [includedSuppliers, includedCount, message, quoteId]);

  const sendReadiness: SendReadiness = useMemo(() => {
    const allReady = readinessChecks.every((c) => c.ready);
    if (allReady) return "ready";
    // supplier(공급사 없음), quote(견적 미저장), contact(이메일 형식 오류)는 hard blocker
    const HARD_BLOCKER_KEYS: ReadinessCheck["key"][] = ["supplier", "quote", "contact"];
    const hasHardBlocker = readinessChecks.some(
      (c) => !c.ready && HARD_BLOCKER_KEYS.includes(c.key),
    );
    return hasHardBlocker ? "blocked" : "needs_review";
  }, [readinessChecks]);

  // ── Actions ──
  const toggleSupplier = useCallback((vendorId: string) => {
    setSuppliers((prev) =>
      prev.map((s) => s.vendorId === vendorId ? { ...s, included: !s.included } : s),
    );
  }, []);

  const addManualVendor = useCallback(() => {
    if (!manualEmail.trim()) return;
    const newSupplier: ResolvedSupplier = {
      vendorId: `manual-${Date.now()}`,
      vendorName: manualName.trim() || manualEmail.split("@")[0],
      email: manualEmail.trim(),
      contactSource: "manual",
      confidence: "low",
      reason: "수동 입력",
      included: true,
    };
    setSuppliers((prev) => [...prev, newSupplier]);
    setManualEmail("");
    setManualName("");
    setShowManualFallback(false);
  }, [manualEmail, manualName]);

  const handleSubmit = async () => {
    if (sendReadiness === "blocked") return;

    if (includedSuppliers.length === 0) {
      toast({ title: "전달 대상 없음", description: "최소 1개 공급사를 선택해주세요.", variant: "destructive" });
      return;
    }
    if (!quoteId) {
      toast({ title: "견적 ID 없음", description: "견적을 먼저 저장해주세요.", variant: "destructive" });
      return;
    }

    // 이메일 형식 재검증 — 서버 400 사전 차단
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidSuppliers = includedSuppliers.filter((s) => !emailRegex.test(s.email));
    if (invalidSuppliers.length > 0) {
      toast({
        title: "이메일 형식 오류",
        description: `${invalidSuppliers.map((s) => s.vendorName).join(", ")}의 이메일을 확인해주세요.`,
        variant: "destructive",
      });
      return;
    }

    // expiresInDays 범위 검증 — 서버 스키마와 일치
    const clampedExpires = Math.max(1, Math.min(90, expiresInDays));

    const validVendors = includedSuppliers.map((s) => ({
      email: s.email,
      name: s.vendorName,
    }));

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendors: validVendors,
          message: message.trim() || undefined,
          expiresInDays: clampedExpires,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청 전송에 실패했습니다.");
      }

      const result = await response.json();
      const sentCount = result.summary?.emailsSent ?? result.createdRequests?.length ?? 0;
      const failedCount = result.summary?.emailsFailed ?? 0;
      toast({
        title: failedCount > 0 ? "견적 요청 부분 전달" : "견적 요청 전달 완료",
        description: failedCount > 0
          ? `${sentCount}건 전달 완료, ${failedCount}건 발송 실패 — 실패 건은 재시도해주세요.`
          : `${sentCount}개 공급사에 플랫폼을 통해 견적 요청이 전달되었습니다.`,
        variant: failedCount > 0 ? "destructive" : "default",
      });

      setSuppliers([]);
      setMessage("");
      setExpiresInDays(14);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "견적 요청 전달 실패",
        description: error.message || "견적 요청을 전달할 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // Render — AI Dispatch Readiness Surface
  // ══════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-pg border-slate-600/40 w-full mx-3 md:mx-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 text-base md:text-lg">
            <Send className="h-5 w-5 text-blue-400" />
            공급사 발송 검토
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {hasResolved
              ? `플랫폼이 ${resolvedCount}개 공급사 후보를 선별했습니다. 검토 후 전달을 승인하세요.`
              : "선별 가능한 공급사 후보가 없습니다. 공급사 DB 보강 후 다시 시도하세요."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">

          {/* ═══ Readiness Strip ═══ */}
          <div className={`rounded-lg border px-4 py-3 ${
            sendReadiness === "ready"
              ? "border-emerald-500/25 bg-emerald-950/10"
              : sendReadiness === "needs_review"
                ? "border-amber-500/25 bg-amber-950/10"
                : "border-red-500/25 bg-red-950/10"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {sendReadiness === "ready" ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
                <span className={`text-sm font-semibold ${
                  sendReadiness === "ready" ? "text-emerald-300" : sendReadiness === "needs_review" ? "text-amber-300" : "text-red-300"
                }`}>
                  {sendReadiness === "ready" ? "전달 준비 완료" : sendReadiness === "needs_review" ? "보완 필요" : "전달 불가"}
                </span>
              </div>
              {sendReadiness === "ready" && (
                <span className="text-xs text-emerald-400/70">바로 전달 가능</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {readinessChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-1.5">
                  {check.ready ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <X className="h-3 w-3 text-red-400" />
                  )}
                  <span className={`text-xs ${check.ready ? "text-slate-500" : "text-slate-600"}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
            {readinessChecks.some((c) => !c.ready) && (
              <div className="mt-2 space-y-0.5">
                {readinessChecks.filter((c) => !c.ready).map((c) => (
                  <p key={c.label} className="text-xs text-slate-400">{c.blocker}</p>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Resolved Supplier List — review-only ═══ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-700">
                  선별된 공급사 후보
                </span>
                {includedCount > 0 && (
                  <span className="text-xs text-slate-500">
                    {includedCount}개 선택
                    {excludedSuppliers.length > 0 && ` · ${excludedSuppliers.length}개 제외`}
                  </span>
                )}
              </div>
              {hasResolved && (
                <Badge className="text-xs px-1.5 py-0.5 border-0 bg-blue-600/10 text-blue-400 font-medium">
                  <Sparkles className="h-3 w-3 mr-1" />플랫폼 선별
                </Badge>
              )}
            </div>

            {/* Supplier cards */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto overflow-x-hidden">
              {suppliers.map((supplier) => (
                <SupplierReviewCard
                  key={supplier.vendorId}
                  supplier={supplier}
                  onToggle={() => toggleSupplier(supplier.vendorId)}
                />
              ))}
            </div>

            {/* Empty: no suppliers resolved */}
            {!hasResolved && !showManualFallback && (
              <div className="rounded-lg border border-dashed border-amber-500/25 bg-amber-950/5 px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-600">공급사 후보 선별 실패</p>
                    <p className="text-xs text-slate-500 mt-1">
                      해당 품목에 매칭되는 공급사가 없거나, 플랫폼 공급사 DB에 연락 채널이 등록되지 않았습니다.
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      플랫폼 운영팀에서 공급사 데이터를 보강 중입니다. 급한 경우 수동으로 추가할 수 있습니다.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowManualFallback(true)}
                        className="h-7 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/20"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        AI 후보에 없는 공급사 직접 추가
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual fallback — only when explicitly opened or no suppliers */}
            {showManualFallback && (
              <div className="rounded-lg border border-slate-600/30 bg-sh p-3 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-xs font-medium text-slate-400">AI 후보에 없는 공급사를 직접 추가</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="이메일"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="h-8 text-xs bg-pg border-slate-600/30 text-slate-900 flex-1"
                  />
                  <Input
                    type="text"
                    placeholder="공급사명"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="h-8 text-xs bg-pg border-slate-600/30 text-slate-900 w-36"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowManualFallback(false); setManualEmail(""); setManualName(""); }}
                    className="h-7 text-xs text-slate-500"
                  >
                    닫기
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addManualVendor}
                    disabled={!manualEmail.trim()}
                    className="h-7 text-xs bg-slate-600 hover:bg-slate-500 text-slate-700"
                  >
                    추가
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Message Preview — read-only by default ═══ */}
          {message && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setMessageExpanded(!messageExpanded)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                  전달 메시지 미리보기
                </span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-500">플랫폼 자동 생성 초안</span>
                <ChevronDown className={`h-3 w-3 text-slate-600 ml-auto transition-transform ${messageExpanded ? "rotate-180" : ""}`} />
              </button>

              {messageExpanded && (
                <div className="rounded-lg border border-slate-600/25 bg-sh px-4 py-3">
                  {messageEditing ? (
                    <>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-xs min-h-[100px] bg-pg border-slate-600/30 text-slate-900"
                        autoFocus
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setMessageEditing(false)}
                          className="h-6 text-xs text-slate-400"
                        >
                          완료
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                        {message}
                      </pre>
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => setMessageEditing(true)}
                          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          수정
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ Dispatch Conditions ═══ */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 px-3 py-2.5 rounded-lg border border-slate-600/20 bg-sh">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">응답 요청 기한</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="1"
                max="90"
                value={expiresInDays}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 14;
                  setExpiresInDays(Math.max(1, Math.min(90, v)));
                }}
                className="h-8 md:h-7 text-xs w-16 text-center bg-sh border-bd text-slate-900"
              />
              <span className="text-xs text-slate-500">일 (1~90)</span>
            </div>
          </div>
        </div>

        {/* ═══ Dock ═══ */}
        <DialogFooter className="gap-2 pt-2 border-t border-slate-600/20 flex-col md:flex-row">
          {/* Fallback: manual add link — demoted to footnote */}
          {hasResolved && !showManualFallback && (
            <button
              type="button"
              onClick={() => setShowManualFallback(true)}
              className="text-xs text-slate-600 hover:text-slate-400 mr-auto transition-colors text-left"
            >
              + 후보에 없는 공급사 직접 추가
            </button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-[40px] text-slate-400 hover:text-slate-700 border border-slate-600/30 active:scale-95"
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || sendReadiness === "blocked"}
            className={`min-h-[40px] font-semibold active:scale-95 ${
              sendReadiness === "ready"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : sendReadiness === "needs_review"
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                전달 중…
              </>
            ) : sendReadiness === "blocked" ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                전달 불가
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                선택 공급사에 요청 전달
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// SupplierReviewCard — include/exclude toggle, no email editing
// ══════════════════════════════════════════════════════════════

function SupplierReviewCard({
  supplier,
  onToggle,
}: {
  supplier: ResolvedSupplier;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-lg border px-3 md:px-3.5 py-2 md:py-2.5 transition-all ${
      supplier.included
        ? "border-slate-600/40 bg-slate-50"
        : "border-slate-600/15 bg-sh opacity-40"
    }`}>
      <div className="flex items-center gap-2 md:gap-3">
        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
            supplier.included
              ? "bg-emerald-600/25 border-emerald-500/50 text-emerald-300"
              : "border-slate-600/40 text-transparent hover:border-slate-500/50"
          }`}
        >
          {supplier.included && <Check className="h-3 w-3" />}
        </button>

        {/* Supplier info — compact single-row */}
        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
          <span className="text-xs md:text-sm font-medium text-slate-900 truncate">
            {supplier.vendorName}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 w-fit ${CONFIDENCE_COLOR[supplier.confidence]}`}>
            {supplier.confidence === "high" ? "확실" : supplier.confidence === "medium" ? "보통" : "낮음"}
          </span>
        </div>

        {/* Contact source badge */}
        <span className="text-[10px] text-slate-600 shrink-0 ml-auto md:ml-0">
          {CONTACT_SOURCE_LABEL[supplier.contactSource]}
        </span>
      </div>

      {/* Second row: email + reason */}
      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mt-1 md:mt-0 ml-7 md:ml-8">
        <Mail className="h-3 w-3 text-slate-600 shrink-0" />
        <span className="text-xs text-slate-500 truncate min-w-0">{supplier.email}</span>
        {supplier.reason && (
          <>
            <span className="text-xs text-slate-700">·</span>
            <span className="text-xs text-slate-600 truncate">{supplier.reason}</span>
          </>
        )}
      </div>
    </div>
  );
}
