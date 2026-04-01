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
      label: "공급사 선정",
      ready: supplierOk,
      blocker: supplierOk ? undefined : "발송 대상 공급사가 없습니다",
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const contactOk = includedSuppliers.every((s) => emailRegex.test(s.email));
    checks.push({
      label: "연락처 확인",
      ready: contactOk,
      blocker: contactOk ? undefined : "유효한 이메일이 없는 공급사가 있습니다",
    });

    const draftOk = message.trim().length > 10;
    checks.push({
      label: "메시지 준비",
      ready: draftOk,
      blocker: draftOk ? undefined : "발송 메시지가 준비되지 않았습니다",
    });

    const quoteOk = !!quoteId;
    checks.push({
      label: "견적 연결",
      ready: quoteOk,
      blocker: quoteOk ? undefined : "견적을 먼저 저장해주세요",
    });

    return checks;
  }, [includedSuppliers, includedCount, message, quoteId]);

  const sendReadiness: SendReadiness = useMemo(() => {
    const allReady = readinessChecks.every((c) => c.ready);
    if (allReady) return "ready";
    const hasHardBlocker = readinessChecks.some(
      (c) => !c.ready && (c.label === "견적 연결" || c.label === "공급사 선정"),
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

    const validVendors = includedSuppliers.map((s) => ({
      email: s.email,
      name: s.vendorName,
    }));

    if (validVendors.length === 0) {
      toast({ title: "발송 대상 없음", description: "최소 1개 공급사를 선택해주세요.", variant: "destructive" });
      return;
    }
    if (!quoteId) {
      toast({ title: "견적 ID 없음", description: "견적을 먼저 저장해주세요.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendors: validVendors,
          message: message.trim() || undefined,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청 전송에 실패했습니다.");
      }

      const result = await response.json();
      toast({
        title: "견적 요청 발송 완료",
        description: `${result.sent}개 공급사에게 견적 요청이 전송되었습니다.`,
      });

      setSuppliers([]);
      setMessage("");
      setExpiresInDays(14);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "견적 요청 전송 실패",
        description: error.message || "견적 요청을 전송할 수 없습니다.",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#24272d] border-slate-600/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Send className="h-5 w-5 text-blue-400" />
            견적 요청 발송 준비
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {hasResolved
              ? `시스템이 ${resolvedCount}개 공급사를 준비했습니다. 포함 여부를 확인하고 발송을 승인하세요.`
              : "발송 대상 공급사를 확인할 수 없습니다. 공급사 등록 후 다시 시도해주세요."}
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
                  {sendReadiness === "ready" ? "발송 준비 완료" : sendReadiness === "needs_review" ? "보완 필요" : "발송 불가"}
                </span>
              </div>
              {sendReadiness === "ready" && (
                <span className="text-xs text-emerald-400/70">바로 발송 가능</span>
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
                  <span className={`text-xs ${check.ready ? "text-slate-500" : "text-slate-300"}`}>
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
                <span className="text-sm font-semibold text-slate-200">
                  발송 대상
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
                  <Sparkles className="h-3 w-3 mr-1" />자동 준비
                </Badge>
              )}
            </div>

            {/* Supplier cards */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
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
                    <p className="text-sm text-slate-300">공급사 자동 선정 실패</p>
                    <p className="text-xs text-slate-500 mt-1">
                      견적 품목에 연결된 공급사가 없거나, 공급사 연락처 DB에 등록된 정보가 없습니다.
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
                        수동 추가
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual fallback — only when explicitly opened or no suppliers */}
            {showManualFallback && (
              <div className="rounded-lg border border-slate-600/30 bg-[#1e2126] p-3 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-xs font-medium text-slate-400">예외: 수동 공급사 추가</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="이메일"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="h-8 text-xs bg-[#24272d] border-slate-600/30 text-slate-100 flex-1"
                  />
                  <Input
                    type="text"
                    placeholder="공급사명"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="h-8 text-xs bg-[#24272d] border-slate-600/30 text-slate-100 w-36"
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
                    className="h-7 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200"
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
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300">
                  발송 메시지
                </span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-500">자동 생성</span>
                <ChevronDown className={`h-3 w-3 text-slate-600 ml-auto transition-transform ${messageExpanded ? "rotate-180" : ""}`} />
              </button>

              {messageExpanded && (
                <div className="rounded-lg border border-slate-600/25 bg-[#1e2126] px-4 py-3">
                  {messageEditing ? (
                    <>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-xs min-h-[100px] bg-[#24272d] border-slate-600/30 text-slate-100"
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
          <div className="flex items-center gap-4 px-3 py-2.5 rounded-lg border border-slate-600/20 bg-[#1e2126]">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">회신 마감</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 14)}
                className="h-7 text-xs w-16 text-center bg-[#24272d] border-slate-600/30 text-slate-100"
              />
              <span className="text-xs text-slate-500">일</span>
            </div>
          </div>
        </div>

        {/* ═══ Dock ═══ */}
        <DialogFooter className="gap-2 pt-2 border-t border-slate-600/20">
          {/* Fallback: manual add link — demoted to footnote */}
          {hasResolved && !showManualFallback && (
            <button
              type="button"
              onClick={() => setShowManualFallback(true)}
              className="text-xs text-slate-600 hover:text-slate-400 mr-auto transition-colors"
            >
              + 수동 추가
            </button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-200 border border-slate-600/30"
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || sendReadiness === "blocked"}
            className={`font-semibold ${
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
                발송 중…
              </>
            ) : sendReadiness === "blocked" ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                발송 불가
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                발송 승인
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
    <div className={`rounded-lg border px-3.5 py-2.5 transition-all ${
      supplier.included
        ? "border-slate-600/40 bg-[#2a2e35]"
        : "border-slate-600/15 bg-[#1e2126] opacity-40"
    }`}>
      <div className="flex items-center gap-3">
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
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100 truncate">
            {supplier.vendorName}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${CONFIDENCE_COLOR[supplier.confidence]}`}>
            {supplier.confidence === "high" ? "확실" : supplier.confidence === "medium" ? "보통" : "낮음"}
          </span>
        </div>

        {/* Contact source badge */}
        <span className="text-[10px] text-slate-600 shrink-0">
          {CONTACT_SOURCE_LABEL[supplier.contactSource]}
        </span>
      </div>

      {/* Second row: email + reason */}
      <div className="flex items-center gap-2 mt-1 ml-8">
        <Mail className="h-3 w-3 text-slate-600 shrink-0" />
        <span className="text-xs text-slate-500 truncate">{supplier.email}</span>
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
