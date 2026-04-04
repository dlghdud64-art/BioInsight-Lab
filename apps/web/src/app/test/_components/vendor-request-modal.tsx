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
} from "lucide-react";

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

interface ResolvedSupplier {
  vendorId: string;
  vendorName: string;
  email: string;
  contactSource: "supplier_book" | "recent_rfq" | "ai_recommended" | "manual";
  confidence: "high" | "medium" | "low";
  reason?: string;
  lastUsed?: string;
  included: boolean;
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
  supplier_book: "공급사 연락처 DB",
  recent_rfq: "최근 견적 이력",
  ai_recommended: "AI 추천",
  manual: "수동 입력",
};

const CONFIDENCE_COLOR: Record<ResolvedSupplier["confidence"], string> = {
  high: "text-emerald-400 border-emerald-500/25 bg-emerald-600/10",
  medium: "text-amber-400 border-amber-500/25 bg-amber-600/10",
  low: "text-red-400 border-red-500/25 bg-red-600/10",
};

function buildDefaultDraft(quoteSummary?: string): string {
  return [
    "안녕하세요,",
    "",
    quoteSummary
      ? `아래 품목에 대한 견적을 요청드립니다: ${quoteSummary}`
      : "첨부 품목에 대한 견적을 요청드립니다.",
    "",
    "납기, 재고, 최소 주문 수량, 단가를 포함하여 회신 부탁드립니다.",
    "",
    "감사합니다.",
  ].join("\n");
}

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

  // ── Supplier state ──
  const [suppliers, setSuppliers] = useState<ResolvedSupplier[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");

  // ── Message state ──
  const [message, setMessage] = useState("");
  const [messageEditing, setMessageEditing] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Initialize from resolved data ──
  useEffect(() => {
    if (!open) return;
    if (resolvedSuppliersInput && resolvedSuppliersInput.length > 0) {
      setSuppliers(resolvedSuppliersInput);
      setManualMode(false);
    } else {
      // No AI resolution — fallback to empty manual mode
      setSuppliers([]);
      setManualMode(true);
    }
    setMessage(draftMessageInput || buildDefaultDraft(quoteSummary));
    setMessageEditing(false);
  }, [open, resolvedSuppliersInput, draftMessageInput, quoteSummary]);

  // ── Derived ──
  const includedSuppliers = suppliers.filter((s) => s.included);
  const hasAiResolved = suppliers.length > 0 && !manualMode;

  // ── Readiness ──
  const readinessChecks = useMemo<ReadinessCheck[]>(() => {
    const checks: ReadinessCheck[] = [];

    // Supplier resolved
    const supplierOk = includedSuppliers.length > 0;
    checks.push({
      label: "공급사 식별",
      ready: supplierOk,
      blocker: supplierOk ? undefined : "발송 대상 공급사가 없습니다",
    });

    // Contact resolved
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const contactOk = includedSuppliers.every((s) => emailRegex.test(s.email));
    checks.push({
      label: "연락처 확인",
      ready: contactOk,
      blocker: contactOk ? undefined : "유효한 이메일이 없는 공급사가 있습니다",
    });

    // Draft prepared
    const draftOk = message.trim().length > 10;
    checks.push({
      label: "발송 초안",
      ready: draftOk,
      blocker: draftOk ? undefined : "요청 메시지가 너무 짧습니다",
    });

    // Quote ID
    const quoteOk = !!quoteId;
    checks.push({
      label: "견적 연결",
      ready: quoteOk,
      blocker: quoteOk ? undefined : "견적을 먼저 저장해주세요",
    });

    return checks;
  }, [includedSuppliers, message, quoteId]);

  const sendReadiness: SendReadiness = useMemo(() => {
    const allReady = readinessChecks.every((c) => c.ready);
    if (allReady) return "ready";
    const hasHardBlocker = readinessChecks.some((c) => !c.ready && (c.label === "견적 연결" || c.label === "공급사 식별"));
    return hasHardBlocker ? "blocked" : "needs_review";
  }, [readinessChecks]);

  // ── Actions ──
  const toggleSupplier = useCallback((vendorId: string) => {
    setSuppliers((prev) =>
      prev.map((s) => s.vendorId === vendorId ? { ...s, included: !s.included } : s),
    );
  }, []);

  const editSupplierEmail = useCallback((vendorId: string, email: string) => {
    setSuppliers((prev) =>
      prev.map((s) => s.vendorId === vendorId ? { ...s, email, contactSource: "manual" as const } : s),
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
    setManualMode(false);
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
        title: "견적 요청 전송 완료",
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
  // Render
  // ══════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#24272d] border-slate-600/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Mail className="h-5 w-5 text-blue-400" />
            견적 요청 발송 검토
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {hasAiResolved
              ? "AI가 공급사와 연락처를 준비했습니다. 발송 전 내용만 확인하세요."
              : "공급사 정보를 입력하여 견적 요청을 발송합니다."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">

          {/* ═══ Send Readiness Strip ═══ */}
          <div className={`rounded-lg border px-4 py-3 ${
            sendReadiness === "ready"
              ? "border-emerald-500/25 bg-emerald-950/10"
              : sendReadiness === "needs_review"
                ? "border-amber-500/25 bg-amber-950/10"
                : "border-red-500/25 bg-red-950/10"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {sendReadiness === "ready" ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : sendReadiness === "needs_review" ? (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
              <span className={`text-sm font-semibold ${
                sendReadiness === "ready" ? "text-emerald-300" : sendReadiness === "needs_review" ? "text-amber-300" : "text-red-300"
              }`}>
                {sendReadiness === "ready" ? "발송 준비 완료" : sendReadiness === "needs_review" ? "보완 필요" : "발송 차단"}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {readinessChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-1.5">
                  {check.ready ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <X className="h-3 w-3 text-red-400" />
                  )}
                  <span className={`text-xs ${check.ready ? "text-slate-400" : "text-slate-300"}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
            {readinessChecks.some((c) => !c.ready) && (
              <div className="mt-2 space-y-1">
                {readinessChecks.filter((c) => !c.ready).map((c) => (
                  <p key={c.label} className="text-xs text-slate-400">{c.blocker}</p>
                ))}
              </div>
            )}
          </div>

          {/* ═══ AI-Resolved Suppliers ═══ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-400" />
                <Label className="text-sm font-semibold text-slate-200">발송 대상 공급사</Label>
                {hasAiResolved && (
                  <Badge className="text-xs px-1.5 py-0.5 border-0 bg-blue-600/10 text-blue-400 font-medium">
                    <Sparkles className="h-3 w-3 mr-1" />AI 추천
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setManualMode(true)}
                className="h-7 text-xs text-slate-400 hover:text-slate-200"
              >
                <Plus className="h-3 w-3 mr-1" />
                수동 추가
              </Button>
            </div>

            {/* Resolved supplier cards */}
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.vendorId}
                  supplier={supplier}
                  onToggle={() => toggleSupplier(supplier.vendorId)}
                  onEditEmail={(email) => editSupplierEmail(supplier.vendorId, email)}
                />
              ))}

              {suppliers.length === 0 && !manualMode && (
                <div className="flex items-center gap-3 px-4 py-4 rounded-lg border border-dashed border-slate-600/40 bg-[#1e2126]">
                  <Info className="h-4 w-4 text-slate-500 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-400">추천 공급사가 없습니다</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      request assembly에서 공급사 정보가 전달되지 않았습니다. 수동으로 추가해주세요.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Manual input panel */}
            {manualMode && (
              <div className="rounded-lg border border-slate-600/30 bg-[#1e2126] p-3 space-y-2">
                <p className="text-xs font-medium text-slate-400">새 연락처 입력</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="이메일 (필수)"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="h-9 text-sm bg-[#24272d] border-slate-600/30 text-slate-100 flex-1"
                  />
                  <Input
                    type="text"
                    placeholder="공급사명"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="h-9 text-sm bg-[#24272d] border-slate-600/30 text-slate-100 w-40"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setManualMode(false); setManualEmail(""); setManualName(""); }}
                    className="h-7 text-xs text-slate-400"
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addManualVendor}
                    disabled={!manualEmail.trim()}
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    추가
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Draft Message ═══ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-200">발송 메시지</Label>
              {!messageEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessageEditing(true)}
                  className="h-7 text-xs text-slate-400 hover:text-slate-200"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  수정
                </Button>
              )}
            </div>
            {messageEditing ? (
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-sm min-h-[120px] bg-[#1e2126] border-slate-600/30 text-slate-100"
                autoFocus
              />
            ) : (
              <div className="rounded-lg border border-slate-600/25 bg-[#1e2126] px-4 py-3">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {message || "(메시지 없음)"}
                </pre>
              </div>
            )}
            <p className="text-xs text-slate-500">
              {hasAiResolved ? "AI가 요청 내용 기반으로 초안을 작성했습니다" : "메시지는 이메일과 함께 공급사에게 전달됩니다"}
            </p>
          </div>

          {/* ═══ Expiration ═══ */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-slate-600/25 bg-[#1e2126]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-300">회신 마감</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 14)}
                className="h-8 text-sm w-20 text-center bg-[#24272d] border-slate-600/30 text-slate-100"
              />
              <span className="text-sm text-slate-400">일 후</span>
            </div>
          </div>
        </div>

        {/* ═══ Footer / Dock ═══ */}
        <DialogFooter className="gap-2">
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
                전송 중...
              </>
            ) : sendReadiness === "blocked" ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                발송 차단됨
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                견적 요청 발송
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// SupplierCard — individual resolved supplier display
// ══════════════════════════════════════════════════════════════

function SupplierCard({
  supplier,
  onToggle,
  onEditEmail,
}: {
  supplier: ResolvedSupplier;
  onToggle: () => void;
  onEditEmail: (email: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(supplier.email);

  return (
    <div className={`rounded-lg border px-4 py-3 transition-all ${
      supplier.included
        ? "border-slate-600/40 bg-[#2a2e35]"
        : "border-slate-600/20 bg-[#1e2126] opacity-50"
    }`}>
      <div className="flex items-start gap-3">
        {/* Toggle checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            supplier.included
              ? "bg-emerald-600/25 border-emerald-500/50 text-emerald-300"
              : "border-slate-600/40 text-transparent hover:border-slate-500/50"
          }`}
        >
          {supplier.included && <Check className="h-3 w-3" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Vendor name + confidence badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-100 truncate">{supplier.vendorName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded border ${CONFIDENCE_COLOR[supplier.confidence]}`}>
              {supplier.confidence === "high" ? "확실" : supplier.confidence === "medium" ? "보통" : "낮음"}
            </span>
          </div>

          {/* Email — read-only or editable */}
          <div className="flex items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-7 text-xs bg-[#1e2126] border-slate-600/30 text-slate-100 flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { onEditEmail(editEmail); setEditing(false); }}
                  className="h-7 text-xs px-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  저장
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditEmail(supplier.email); setEditing(false); }}
                  className="h-7 text-xs px-2 text-slate-400"
                >
                  취소
                </Button>
              </div>
            ) : (
              <>
                <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                <span className="text-xs text-slate-300 truncate">{supplier.email}</span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-slate-500 hover:text-blue-400 transition-colors shrink-0"
                >
                  변경
                </button>
              </>
            )}
          </div>

          {/* Contact source + reason */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-slate-500">
              출처: {CONTACT_SOURCE_LABEL[supplier.contactSource]}
            </span>
            {supplier.reason && (
              <>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-500">{supplier.reason}</span>
              </>
            )}
            {supplier.lastUsed && (
              <>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-500">최근: {supplier.lastUsed}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
