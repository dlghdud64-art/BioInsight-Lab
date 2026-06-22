"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  /** §quote-screen-sian P6.4 — 사람이 읽는 견적 ref(quoteDisplayRef 결과). cuid 노출 봉합용. */
  quoteRef?: string;
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

interface SentTrackingEvidence {
  id: string;
  quoteId: string;
  recipientCount: number;
  statusLabel: string;
  operatorName: string;
  recordedAt: string;
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

const CONTACT_SOURCE_LABEL: Record<ResolvedSupplier["contactSource"], string> = {
  supplier_book: "공급사 DB",
  recent_rfq: "견적 이력",
  ai_recommended: "AI 추천",
  manual: "수동 입력",
  // #user-supplier-registration Phase 5 — operator 직접 등록한 조직 거래처.
  org_book: "조직 거래처",
};

const CONTACT_SOURCE_ICON: Record<ResolvedSupplier["contactSource"], string> = {
  supplier_book: "DB",
  recent_rfq: "이력",
  ai_recommended: "AI",
  manual: "수동",
  org_book: "거래처",
};

const CONFIDENCE_COLOR: Record<ResolvedSupplier["confidence"], string> = {
  high: "text-emerald-700 border-emerald-200 bg-emerald-50",
  medium: "text-yellow-700 border-yellow-200 bg-yellow-50",
  low: "text-rose-700 border-rose-200 bg-rose-50",
};

const getDispatchTrackingStorageKey = (quoteId?: string) =>
  quoteId ? `labaxis:quote-dispatch:${quoteId}:sent-tracking` : null;

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════

export function VendorRequestModal({
  open,
  onOpenChange,
  quoteId,
  quoteRef,
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
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [sentTracking, setSentTracking] = useState<SentTrackingEvidence | null>(null);
  const [remediationOpened, setRemediationOpened] = useState(false);
  // §4c-rebloat(호영님) — 받는 공급사 카드와 후보 리스트 중복 노출 → 선택됨(includedCount>0) 시 후보 리스트(Section 1·2) 접기.
  const [candidatesExpanded, setCandidatesExpanded] = useState(false);
  const manualEmailInputRef = useRef<HTMLInputElement | null>(null);
  const trackingStorageKey = getDispatchTrackingStorageKey(quoteId);

  // ── Initialize from resolved data ──
  // §11.293 #vendor-dispatch-toggle-reset-fix — 호영님 P0 (2026-05-24):
  // 기존 useEffect 가 [open, resolvedSuppliersInput, draftMessageInput,
  // trackingStorageKey] dependency 였음 → parent 가 resolvedSuppliersInput
  // 을 새 reference 로 전달할 때마다 setSuppliers(resolvedSuppliersInput)
  // 호출 → 사용자 toggle 후 즉시 reset 회귀 (호영님 spec Case C 정확).
  // Fix: open === false → true 전환 시에만 init. open 이 이미 true 인
  // 상태에서 prop reference 변경은 무시 (사용자 선택 보존).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) return;
    // 이미 열려있던 상태에서 prop reference 변경은 무시 — 사용자 선택 보존
    if (wasOpen) return;
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
    setMessageExpanded(true);
    setConfirmationOpen(false);
    setRemediationOpened(false);
    if (!trackingStorageKey || typeof window === "undefined") {
      setSentTracking(null);
      return;
    }
    try {
      const storedTracking = window.localStorage.getItem(trackingStorageKey);
      setSentTracking(storedTracking ? JSON.parse(storedTracking) as SentTrackingEvidence : null);
    } catch {
      setSentTracking(null);
    }
  }, [open, resolvedSuppliersInput, draftMessageInput, trackingStorageKey]);

  // ── Derived ──
  const includedSuppliers = suppliers.filter((s) => s.included);
  const excludedSuppliers = suppliers.filter((s) => !s.included);
  const hasResolved = suppliers.length > 0;
  const resolvedCount = suppliers.length;
  const includedCount = includedSuppliers.length;

  // §11.229 #quote-management-v2-phase-c2 — 호영님 v2 #21 공급사 DB UI 3 source grouping.
  //   resolveSuppliers (4 priority source) 의 contactSource 를 3 UX section
  //   으로 grouping. canonical truth 변경 0 — UI derive only.
  //
  //   Section 1 등록된 공급사 = recent_rfq + org_book + supplier_book (백엔드 등록)
  //   Section 2 LabAxis 추천   = ai_recommended (LabAxis 자동 추출)
  //   Section 3 이메일 직접 입력 = manual (운영자 직접 추가) — form always-visible
  //
  //   호영님 결정 (2026-05-12): (c) section header grouping (Tabs 거부 —
  //   same-canvas + canonical truth 정합) + 3 section default.
  const { registeredSuppliers, recommendedSuppliers, manualSuppliers } = useMemo(() => {
    const registered: ResolvedSupplier[] = [];
    const recommended: ResolvedSupplier[] = [];
    const manual: ResolvedSupplier[] = [];
    for (const s of suppliers) {
      if (s.contactSource === "ai_recommended") {
        recommended.push(s);
      } else if (s.contactSource === "manual") {
        manual.push(s);
      } else {
        // recent_rfq / org_book / supplier_book
        registered.push(s);
      }
    }
    return { registeredSuppliers: registered, recommendedSuppliers: recommended, manualSuppliers: manual };
  }, [suppliers]);

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
  const firstReadinessBlocker = readinessChecks.find((check) => !check.ready)?.blocker;
  const contactBlocker = readinessChecks.find((check) => check.key === "contact" && !check.ready)?.blocker;
  const sendStateLabel =
    sendReadiness === "ready" ? "전송 가능" : sendReadiness === "needs_review" ? "검토 필요" : "연락처 필요";
  const sendGateDetail =
    sendReadiness === "ready"
      ? "전송 전 미리보기와 수신자 검증이 완료되었습니다."
      : firstReadinessBlocker ?? "검토가 필요합니다.";

  // §quote-screen-sian P6.4 §09 — 단일 가로 스텝퍼 파생.
  //   readinessChecks(supplier/contact/draft) + sendReadiness 재사용 — 로직 0 변경, 표현만 통합.
  //   완료(ready)=초록 / 현재(첫 미완)=파랑 / 막힘(hard blocker)=앰버 / 이후 대기=회색.
  const dispatchSteps = useMemo(() => {
    const base = [
      { key: "supplier", label: "공급사 선택", ready: includedCount > 0 },
      { key: "contact", label: "연락처 확인", ready: includedCount > 0 && !contactBlocker },
      { key: "draft", label: "메시지 검토", ready: message.trim().length > 10 },
      { key: "send", label: "전송", ready: sendReadiness === "ready" },
    ];
    const firstPendingIdx = base.findIndex((s) => !s.ready);
    return base.map((s, i) => {
      const current = i === firstPendingIdx;
      const blocked = current && sendReadiness === "blocked";
      const state: "done" | "blocked" | "current" | "pending" = s.ready
        ? "done"
        : blocked
          ? "blocked"
          : current
            ? "current"
            : "pending";
      const tone = s.ready
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : blocked
          ? "border-yellow-200 bg-yellow-50 text-yellow-700"
          : current
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-slate-50 text-slate-400";
      // §quote-screen-sian §09 stepper — 시안 2단 라벨의 sub 문구. 하드코딩이
      //   아니라 실제 step state(공급사/연락처/메시지/전송 readiness) 파생.
      //   거짓 "완료" 표기 0 — done 일 때만 "선택 완료/확인됨/초안 준비됨/바로 가능".
      const subMap: Record<string, Record<typeof state, string>> = {
        supplier: { done: "선택 완료", blocked: "후보 없음", current: "선택 필요", pending: "대기" },
        contact: { done: "확인됨", blocked: "연락처 필요", current: "확인 필요", pending: "대기" },
        draft: { done: "초안 준비됨", blocked: "검토 필요", current: "검토 필요", pending: "초안 준비됨" },
        send: { done: "바로 가능", blocked: "대기", current: "검토 후 전송", pending: "대기" },
      };
      const sub = subMap[s.key]?.[state] ?? "";
      return { key: s.key, label: s.label, done: s.ready, current, blocked, tone, state, sub };
    });
  }, [includedCount, contactBlocker, message, sendReadiness]);

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
    // §11.229 — showManualFallback state 는 Section 3 always-visible 후 deprecated.
    setShowManualFallback(false);
  }, [manualEmail, manualName]);

  const openSupplierRemediation = useCallback(() => {
    setRemediationOpened(true);
    requestAnimationFrame(() => {
      manualEmailInputRef.current?.focus();
      manualEmailInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const handleSubmit = async () => {
    if (sentTracking) return;
    if (sendReadiness !== "ready") return;

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
      // §11.314-b-2 (호영님 옵션 A) — 이메일(vendor-requests, sender mock =
      //   실제 발송 0) 흐름을 견적서 PDF 다운로드 + mailto 로 교체.
      //   실제 전송 = 사용자가 다운로드된 PDF 를 메일 첨부 (mailto 로 공급사
      //   이메일 + 제목/본문 pre-fill). canonical: PDF = Quote snapshot.
      const response = await csrfFetch(`/api/quotes/${quoteId}/generate-pdf`, {
        method: "POST",
      });

      if (!response.ok) {
        // §11.326 (호영님 P0) — server 응답 status + body 추출하여 root cause 진단 가능하게.
        //   서버 로그용 raw error 와 사용자 안내 메시지 분리.
        const status = response.status;
        let serverDetail = "";
        try {
          const body = await response.json();
          serverDetail = body?.error ?? body?.message ?? "";
        } catch {
          // body 가 JSON 아닐 수 있음 — silent.
        }
        console.error("[§11.326] PDF 생성 실패", { status, serverDetail, quoteId });
        const errorTag = status === 403 ? "인증/권한" : status === 404 ? "견적 없음" : status >= 500 ? "서버 오류" : "요청 오류";
        throw new Error(`${errorTag} (${status})${serverDetail ? ` · ${serverDetail}` : ""}`);
      }

      // PDF blob 다운로드
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `견적요청서-${quoteRef ?? quoteId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // mailto — 공급사 이메일 pre-fill (사용자가 PDF 첨부하여 직접 전송)
      const recipients = validVendors.map((v) => v.email).filter(Boolean).join(",");
      const mailSubject = encodeURIComponent("견적 요청서");
      const mailBody = encodeURIComponent(
        (message.trim() ? message.trim() + "\n\n" : "") +
          "첨부된 견적 요청서를 확인하시고 견적가를 기재하여 회신 부탁드립니다.",
      );
      if (recipients && typeof window !== "undefined") {
        window.location.href = `mailto:${recipients}?subject=${mailSubject}&body=${mailBody}`;
      }

      const recipientCount = validVendors.length;
      toast({
        title: "견적서 PDF 다운로드 완료",
        description: `다운로드된 견적 요청서를 ${recipientCount}개 공급사 메일에 첨부하여 전송하세요.`,
      });

      const trackingEvidence: SentTrackingEvidence = {
        id: `quote-pdf-${quoteId}-${Date.now()}`,
        quoteId,
        recipientCount,
        statusLabel: "PDF 다운로드 완료",
        operatorName: "발송 운영자",
        recordedAt: new Date().toISOString(),
      };
      setSentTracking(trackingEvidence);
      if (trackingStorageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(trackingStorageKey, JSON.stringify(trackingEvidence));
        } catch {
          // 추적 상태 저장 실패는 다운로드 자체를 막지 않습니다.
        }
      }
      setConfirmationOpen(false);
      onSuccess?.();
    } catch (error: any) {
      // §11.326 (호영님 P0 spec §5) — friendly + actionable 메시지.
      //   raw error.message 는 console.error 만 (Sentry 추적), 사용자에게는 임시 우회 안내.
      const reason = typeof error?.message === "string" ? error.message : "";
      toast({
        title: "견적서 PDF를 만들 수 없습니다",
        description:
          (reason ? `사유: ${reason}\n\n` : "") +
          "현재 PDF 생성이 불안정합니다. 잠시 후 다시 시도하거나, 메시지 미리보기 내용을 복사해서 직접 메일로 보내실 수 있습니다.",
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* §11.54 — light-theme alignment.
          Pre-§11.54: dark-island (bg-pg + slate/dark warning 톤) 잔재 was painting a dark
          island inside LabAxis light chrome — same class of regression
          as §11.43/§11.48 but expressed in Tailwind classes (the
          §11.45 inline-hex grep can't catch this; future §11.55 may
          extend the script). */}
      <DialogContent
        data-testid="quote-dispatch-dock"
        className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 w-full mx-3 md:mx-0"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 text-base md:text-lg">
            <Send className="h-5 w-5 text-blue-600" />
            공급사 발송 검토
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {hasResolved
              ? `플랫폼이 ${resolvedCount}개 공급사 후보를 선별했습니다. 검토 후 전달을 승인하세요.`
              : "공급사를 직접 추가하거나 플랫폼 DB 보강을 기다려 주세요."}
          </DialogDescription>
          {/* §09 sian — 케이스 ref + 담당자 칩(시안 헤더 정합). cuid 미노출(quoteRef 파생). */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              케이스 {quoteRef ?? "저장 필요"}
            </span>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              담당 발송 운영자
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* ═══ §quote-screen-sian P6.4 §09 — 단일 가로 스텝퍼 ═══
              중복 4블록(handoff-line·review-visible·recipient-summary·recipient-evidence)
              + readiness strip 통합. 공급사 선택→연락처 확인→메시지 검토→전송.
              완료=초록 / 현재=파랑 / 막힘=앰버 / 이후 대기=회색. honesty CTA(보강)는 막힘 시 하단. */}
          <div
            data-testid="quote-dispatch-stepper"
            className="rounded-lg border border-slate-200 bg-white px-3 py-3"
          >
            {/* §quote-screen-sian §09 — 시안 원형 노드 스텝퍼(호영님 2026-06-22
                지시: 사각칩 철회, 시안 1:1). sdot 30px 원 + 연결선(sline) +
                2단 라벨(slabel/ssub). 상태/문구는 dispatchSteps(실제 readiness)
                파생 — 거짓 완료 0. */}
            <ol className="flex items-start gap-0">
              {dispatchSteps.map((step, i) => (
                <li
                  key={step.key}
                  data-testid={`quote-dispatch-step-${step.key}`}
                  data-step-state={step.state}
                  className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
                >
                  {/* 연결선 — 시안 .sline (첫 노드 제외, 진행 도달 시 emerald) */}
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={`absolute right-1/2 top-[14px] z-0 h-0.5 w-full ${
                        step.done || step.current ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                  {/* 원형 노드 — 시안 .sdot 30px */}
                  <span
                    className={`relative z-[1] grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border ${
                      step.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : step.blocked
                          ? "border-yellow-300 bg-yellow-50 text-yellow-600"
                          : step.current
                            ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100"
                            : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {step.done ? (
                      <Check className="h-[15px] w-[15px]" />
                    ) : step.blocked ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <span className="text-[12px] font-extrabold tabular-nums">{i + 1}</span>
                    )}
                  </span>
                  {/* 2단 라벨 — 시안 .slabel / .ssub (ssub 모바일 숨김) */}
                  <span
                    className={`text-[12px] font-bold leading-tight tracking-tight ${
                      step.current
                        ? "text-blue-700"
                        : step.blocked
                          ? "text-yellow-700"
                          : step.done
                            ? "text-slate-700"
                            : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-[10.5px] leading-tight text-slate-400 sm:block">
                    {step.sub}
                  </span>
                </li>
              ))}
            </ol>
            {sendReadiness === "blocked" && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                <p className="text-xs font-medium text-yellow-700">
                  {firstReadinessBlocker ?? "공급사를 먼저 추가하세요"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="quote-dispatch-supplier-remediation-visible-cta"
                  onClick={openSupplierRemediation}
                  className="min-h-[40px] bg-blue-600 text-white hover:bg-blue-700"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  공급사 후보 보강
                </Button>
              </div>
            )}
            {remediationOpened && sendReadiness === "blocked" && (
              <p
                role="status"
                data-testid="quote-dispatch-remediation-result"
                className="mt-2 text-xs font-medium text-yellow-800"
              >
                보강 필요: 아래에서 공급사 연락처를 직접 추가하세요.
              </p>
            )}
          </div>

          {/* ═══ §09 P6.4 4c — 2상태 배너 (공급사 있음=전송 준비 / 없음=공급사 먼저 추가) ═══ */}
          {includedCount > 0 ? (
            <div
              data-testid="quote-dispatch-state-banner"
              data-state="ready"
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                sendReadiness === "ready"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
              }`}
            >
              {sendReadiness === "ready" ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {sendReadiness === "ready" ? "전송 준비 완료" : "전송 전 검토 필요"}
                </p>
                <p className="text-xs">
                  {sendReadiness === "ready"
                    ? "공급사 선별 · 연락 채널 · 메시지 · 견적 연결까지 모두 확인됐습니다."
                    : `공급사 ${includedCount}곳 선택됨 · 연락처·메시지 확인이 필요합니다.`}
                </p>
              </div>
            </div>
          ) : (
            <div
              data-testid="quote-dispatch-state-banner"
              data-state="empty"
              className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-yellow-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">공급사를 먼저 추가</span>
              <span className="text-xs">· 전송하려면 최소 1곳이 필요합니다</span>
            </div>
          )}

          {/* ═══ §09 P6.4 4c — 받는 공급사 카드(아바타·이메일·확인 배지). includedSuppliers 파생 재사용. ═══ */}
          {includedCount > 0 && (
            <div data-testid="quote-dispatch-recipient-cards" className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">받는 공급사</span>
                <span className="text-[11px] text-slate-500 tabular-nums">{includedCount}곳</span>
                {/* §09 sian — "다시 선택" = 후보 리스트 펼쳐 수신처 변경(접기 토글 재사용). */}
                <button
                  type="button"
                  onClick={() => setCandidatesExpanded(true)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  다시 선택
                </button>
              </div>
              <div className="max-h-[160px] space-y-1.5 overflow-y-auto overflow-x-hidden">
                {includedSuppliers.map((supplier) => {
                  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email);
                  // §09 시안 — 공급사별 컬러 아바타(왼쪽 이미지 차용, 결정론 팔레트).
                  const avatarPalette = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-teal-100 text-teal-700", "bg-yellow-100 text-yellow-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
                  const avatarTone = avatarPalette[(supplier.vendorName.charCodeAt(0) || 0) % avatarPalette.length];
                  return (
                    <div
                      key={supplier.vendorId}
                      data-testid="quote-dispatch-recipient-card"
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                        emailValid ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
                      }`}
                    >
                      {/* §09 시안 — 확인된 수신처는 초록 ✓ 원(honesty: 이메일 무효 시 미표시). */}
                      {emailValid && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone}`}>
                        {supplier.vendorName.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-medium text-slate-900">{supplier.vendorName}</p>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              emailValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {emailValid ? "연락처 확인" : "확인 필요"}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-500">{supplier.email || "연락처 없음"}</p>
                      </div>
                      {/* §09 시안 — 우측 "전송 대상" 라벨(무효 시 "보류"로 정직 표기). */}
                      <span className={`shrink-0 text-[11px] font-medium ${emailValid ? "text-emerald-600" : "text-rose-500"}`}>
                        {emailValid ? "전송 대상" : "보류"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ §11.229 #quote-management-v2-phase-c2 — 3 source grouping ═══
              호영님 v2 #21 공급사 DB UI 3 경로 modal. 단일 scroll list 안
              3 section 으로 grouping (Tabs 도입 0 — same-canvas 보존). */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {/* §4c-rebloat — 선택됨 시 후보 리스트 접기 토글(받는 공급사 카드와 중복 해소). 미선택 시 비활성(항상 펼침). */}
              <button
                type="button"
                onClick={() => { if (includedCount > 0) setCandidatesExpanded((v) => !v); }}
                disabled={includedCount === 0}
                aria-expanded={includedCount === 0 || candidatesExpanded}
                className="flex items-center gap-2 text-left disabled:cursor-default"
              >
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-900">
                  공급사 후보
                </span>
                {includedCount > 0 && (
                  <span className="text-xs text-slate-500">
                    {includedCount}개 선택
                    {excludedSuppliers.length > 0 && ` · ${excludedSuppliers.length}개 제외`}
                  </span>
                )}
                {includedCount > 0 && (
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${candidatesExpanded ? "rotate-180" : ""}`} />
                )}
              </button>
              {hasResolved && (
                <Badge className="text-xs px-1.5 py-0.5 border-0 bg-blue-50 text-blue-700 font-medium">
                  <Sparkles className="h-3 w-3 mr-1" />플랫폼 선별
                </Badge>
              )}
            </div>

            {/* §4c-rebloat — 후보 리스트(Section 1·2)는 선택 후 접힘. 직접 입력(Section 3)은 항상 노출. */}
            {(includedCount === 0 || candidatesExpanded) && (
            <>
            {/* Section 1 — 등록된 공급사 (recent_rfq + org_book + supplier_book) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-semibold text-slate-700">등록된 공급사</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {registeredSuppliers.length}건
                </span>
              </div>
              {registeredSuppliers.length > 0 ? (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto overflow-x-hidden">
                  {registeredSuppliers.map((supplier) => (
                    <SupplierReviewCard
                      key={supplier.vendorId}
                      supplier={supplier}
                      onToggle={() => toggleSupplier(supplier.vendorId)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 px-1 py-1.5">
                  등록된 공급사 후보 없음
                </p>
              )}
            </div>

            {/* Section 2 — LabAxis 추천 (ai_recommended) */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-semibold text-slate-700">LabAxis 추천</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {recommendedSuppliers.length}건
                </span>
              </div>
              {recommendedSuppliers.length > 0 ? (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto overflow-x-hidden">
                  {recommendedSuppliers.map((supplier) => (
                    <SupplierReviewCard
                      key={supplier.vendorId}
                      supplier={supplier}
                      onToggle={() => toggleSupplier(supplier.vendorId)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 px-1 py-1.5">
                  추천 가능한 공급사 없음
                </p>
              )}
            </div>
            </>
            )}

            {/* Section 3 — 이메일 직접 입력 (manual, always-visible form) */}
            <div
              data-testid="quote-dispatch-manual-supplier-panel"
              className="space-y-2 border-t border-slate-100 pt-3"
            >
              <div className="flex items-center gap-2 px-1">
                <UserPlus className="h-3 w-3 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">이메일 직접 입력</span>
                {manualSuppliers.length > 0 && (
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    추가됨 {manualSuppliers.length}건
                  </span>
                )}
              </div>
              {manualSuppliers.length > 0 && (
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto overflow-x-hidden">
                  {manualSuppliers.map((supplier) => (
                    <SupplierReviewCard
                      key={supplier.vendorId}
                      supplier={supplier}
                      onToggle={() => toggleSupplier(supplier.vendorId)}
                    />
                  ))}
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[11px] text-slate-500">
                  후보에 없는 공급사를 직접 추가
                </p>
                <div className="flex gap-2">
                  <Input
                    ref={manualEmailInputRef}
                    type="email"
                    placeholder="이메일"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900 flex-1"
                  />
                  <Input
                    type="text"
                    placeholder="공급사명"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900 w-36"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addManualVendor}
                    disabled={!manualEmail.trim()}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    추가
                  </Button>
                </div>
              </div>
            </div>

            {/* §11.229 — empty state 안내 (선별된 공급사 0건 시).
                기존 §11.54 empty block + manual fallback panel 은
                Section 3 (이메일 직접 입력) 가 always-visible 로 대체.
                empty 안내 자체는 sourcing 보강 흐름 유지. */}
            {!hasResolved && (
              <div className="rounded-lg border border-dashed border-yellow-200 bg-yellow-50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">공급사 후보 선별 실패</p>
                    <p className="text-xs text-slate-600 mt-1">
                      해당 품목에 매칭되는 공급사가 없거나, 플랫폼 공급사 DB에 연락 채널이 등록되지 않았습니다.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      위 <span className="font-medium text-slate-700">"이메일 직접 입력"</span>으로 공급사를 직접 추가할 수 있습니다.
                    </p>
                  </div>
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
                <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                  전달 메시지 미리보기
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">플랫폼 자동 생성 초안</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 ml-auto transition-transform ${messageExpanded ? "rotate-180" : ""}`} />
              </button>

              {messageExpanded && (
                <div data-testid="quote-dispatch-message-preview" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  {messageEditing ? (
                    <>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-xs min-h-[100px] bg-white border-slate-200 text-slate-900"
                        autoFocus
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setMessageEditing(false)}
                          className="h-6 text-xs text-slate-500 hover:text-slate-700"
                        >
                          완료
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {message}
                      </pre>
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => setMessageEditing(true)}
                          className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
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
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-700">응답 요청 기한</span>
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
                className="h-8 md:h-7 text-xs w-16 text-center bg-white border-slate-200 text-slate-900"
              />
              <span className="text-xs text-slate-500">일 (1~90)</span>
            </div>
          </div>
        </div>

        {/* ═══ Dock — Footer is the single primary-action zone (§11.54) ═══
            §11.229 — footer manual link 제거 (Section 3 always-visible 가 대체).
            sendReadiness === "blocked" CTA 도 Section 3 의 input 으로 focus 유도. */}
        {sentTracking && (
          <div
            data-testid="quote-dispatch-sent-tracking-state"
            className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <strong>{sentTracking.statusLabel}</strong>
              <span data-testid="quote-dispatch-sent-tracking-id" className="font-mono text-xs">
                {sentTracking.id}
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              {sentTracking.recipientCount}개 수신처 발송 이력이 남았습니다. 새로고침 후에도 이 견적의 vendor request로 추적합니다.
            </p>
            <p data-testid="quote-dispatch-sent-refresh-proof" className="mt-1 text-xs text-emerald-700">
              dispatch event · 전송 추적 · 담당자: {sentTracking.operatorName} · 견적: {quoteRef ?? sentTracking.quoteId}
            </p>
          </div>
        )}

        <div
          className={`mt-1 rounded-lg border px-4 py-3 text-sm ${
            sendReadiness === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : sendReadiness === "needs_review"
                ? "border-yellow-200 bg-yellow-50 text-yellow-900"
                : "border-red-200 bg-red-50 text-red-900"
          }`}
          data-testid="quote-dispatch-send-gate"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <strong>{sendStateLabel}</strong>
            <span className="text-xs sm:text-right">{sendGateDetail}</span>
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 border-t border-slate-200 flex-col md:flex-row md:items-center">
          {/* §09 시안 — 준비 완료 시 좌측 검증 상태문(정직: ready 일 때만). */}
          {sendReadiness === "ready" && !sentTracking && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 md:mr-auto">
              <Check className="h-3.5 w-3.5" />
              미리보기·수신자 검증 완료
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-[40px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 active:scale-95"
          >
            취소
          </Button>
          {sendReadiness === "blocked" ? (
            <Button
              type="button"
              disabled
              variant="secondary"
              data-testid="quote-dispatch-send-disabled"
              // §11.274 — aria-label 한국어 정합 lock (Phase B smoke 발견).
              // §11.279c-cont — comment 안 영문 인용 한글 swap.
              //   기존 영문 aria-label (공급사 발송 비활성) → SR 사용자가 영문 청취 위험.
              //   visible "선택 공급사에 요청 전달" 와 정합 + (비활성) suffix.
              //   §09 P6.4 — 중복 active 보강 버튼 제거(보강 CTA는 스텝퍼 막힘 배너 단일점).
              aria-label="공급사 요청 전달 (비활성)"
            >
              <Send className="h-4 w-4 mr-2" />
              선택 공급사에 요청 전달
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmationOpen(true)}
              disabled={isSubmitting || sendReadiness !== "ready" || Boolean(sentTracking)}
              data-testid="quote-dispatch-confirm-before-send"
              // §11.274 — aria-label 한국어 정합 lock (Phase B smoke 발견).
              //   visible label 은 sendReadiness 분기로 4종 (전달 중… /
              //   전송 추적 확인됨 / 전송 전 확인 필요 / 최종 확인 후 전송)
              //   변동 — aria-label 은 button intent ("공급사에 전송") 안정화.
              aria-label="견적서 PDF 다운로드"
              className={`min-h-[40px] font-semibold active:scale-95 ${
                sendReadiness === "ready"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-yellow-500 hover:bg-yellow-600 text-white"
              }`}
            >
              {/* §11.314-b-2 — 이메일 mock 교체: PDF 다운로드 + mailto 흐름. 라벨 정합. */}
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  견적서 생성 중…
                </>
              ) : sentTracking ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  PDF 다운로드 완료
                </>
              ) : sendReadiness !== "ready" ? (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  전송 전 확인 필요
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  견적서 PDF 다운로드
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
      <AlertDialogContent data-testid="quote-dispatch-confirmation-modal" className="bg-white border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>발송 전 최종 확인</AlertDialogTitle>
          <AlertDialogDescription>
            수신처와 메시지 미리보기를 확인한 뒤에만 공급사로 전송합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <div data-testid="quote-dispatch-confirmation-recipient" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">수신처</p>
            <p className="mt-1 font-medium text-slate-900">
              {includedSuppliers.map((supplier) => `${supplier.vendorName} <${supplier.email}>`).join(", ") || "선택된 공급사 없음"}
            </p>
          </div>
          <div data-testid="quote-dispatch-confirmation-preview" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">메시지 미리보기</p>
            <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-slate-700">
              {message.trim() || "전송할 메시지가 없습니다."}
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>다시 검토</AlertDialogCancel>
          <Button
            type="button"
            disabled={isSubmitting || sendReadiness !== "ready"}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => { void handleSubmit(); }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            확인 후 전송
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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
  const contactVerified = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email);
  const contactBadgeClass = contactVerified
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className={`rounded-lg border px-3 md:px-3.5 py-2 md:py-2.5 transition-all ${
      supplier.included
        ? "border-slate-200 bg-white"
        : "border-slate-100 bg-slate-50 opacity-60"
    }`}>
      <div className="flex items-center gap-2 md:gap-3">
        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
            supplier.included
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-slate-300 text-transparent hover:border-slate-400"
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

        {/* Contact source badge + 이메일 부재/확인 분기 */}
        <span
          data-testid="quote-dispatch-contact-badge"
          className="text-[10px] text-slate-500 shrink-0 ml-auto md:ml-0"
        >
          {supplier.email
            ? `${CONTACT_SOURCE_LABEL[supplier.contactSource]} · 연락처 확인됨`
            : "연락처 없음"}
        </span>
        <span
          data-testid="quote-dispatch-selected-badge"
          className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
            supplier.included
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {/* §11.237 — file truncation 복구 (sandbox sync drift). */}
          {supplier.included ? "선택됨" : "제외"}
        </span>
      </div>
    </div>
  );
}
