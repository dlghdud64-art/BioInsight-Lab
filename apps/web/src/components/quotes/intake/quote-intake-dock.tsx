"use client";

/**
 * QuoteIntakeDock — Quotes Work Queue 내부 intake capability
 *
 * Smart Sourcing를 독립 페이지 대신 same-canvas right dock로 통합.
 * 두 가지 source:
 *  - manual_upload: 외부 견적서 업로드 → IntakeSession → 정식 요청 전환
 *  - bom_import: BOM 업로드 → BomImportBatch staging → commit
 *
 * 원칙:
 *  - queue row는 commit 시점에만 생성
 *  - IntakeSession / BomImportBatch는 staging only
 *  - parser 결과는 derived snapshot (원본 immutable)
 *  - same-canvas dock 안에서만 동작, 별도 페이지 금지
 */

import { useState, useCallback, useRef } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, FileText, Package, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, X, FileUp, Table2, Users, FolderOpen, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════
   Domain types (staging / transient)
   ══════════════════════════════════════════════════════════════ */

interface ParsedField {
  key: string;
  label: string;
  value: string | number | null;
  confidence: "high" | "review" | "blocked";
  reason?: string;
}

interface IntakeSession {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: "uploading" | "parsing" | "review" | "ready" | "error";
  supplierName?: string;
  parsedFields: ParsedField[];
  rawItems: Array<{
    name: string;
    catalogNumber?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    unit?: string;
  }>;
  errorMessage?: string;
}

interface BomImportItem {
  id: string;
  name: string;
  catalogNumber?: string;
  quantity: number;
  unit?: string;
  category?: string;
  normalized: boolean;
  suggestedGroup?: string;
}

interface BomImportBatch {
  id: string;
  fileName: string;
  status: "uploading" | "parsing" | "review" | "ready" | "error";
  items: BomImportItem[];
  project?: string;
  requester?: string;
  groupingStrategy: "by_category" | "by_supplier" | "single";
  proposedCaseCount: number;
  errorMessage?: string;
}

/* ══════════════════════════════════════════════════════════════
   Component Props
   ══════════════════════════════════════════════════════════════ */

interface QuoteIntakeDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "manual_upload" | "bom_import" | null;
  /** 기존 QuoteCase ID — 있으면 해당 케이스에 attach */
  existingCaseId?: string;
  onCommitSuccess?: () => void;
}

export function QuoteIntakeDock({
  open,
  onOpenChange,
  source,
  existingCaseId,
  onCommitSuccess,
}: QuoteIntakeDockProps) {
  // ── Manual upload state ──
  const [intakeSession, setIntakeSession] = useState<IntakeSession | null>(null);
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualProject, setManualProject] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── BOM import state ──
  const [bomBatch, setBomBatch] = useState<BomImportBatch | null>(null);
  const bomFileInputRef = useRef<HTMLInputElement>(null);

  // ── Common ──
  const [committing, setCommitting] = useState(false);

  const resetState = useCallback(() => {
    setIntakeSession(null);
    setBomBatch(null);
    setManualSupplier("");
    setManualProject("");
    setCommitting(false);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // 닫을 때 staging 초기화
    setTimeout(resetState, 300);
  }, [onOpenChange, resetState]);

  // ══════════════════════════════════════════
  // Manual Upload: 파일 → parse → review
  // ══════════════════════════════════════════
  const handleManualFileUpload = useCallback(async (file: File) => {
    const sessionId = `intake_${Date.now()}`;
    setIntakeSession({
      id: sessionId,
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: "uploading",
      parsedFields: [],
      rawItems: [],
    });

    try {
      // Step 1: Upload + Parse
      setIntakeSession((prev) => prev ? { ...prev, status: "parsing" } : prev);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/quotes/parse-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("파싱 실패");

      const parsed = await res.json();

      // Step 2: Build ParsedFields from response
      const fields: ParsedField[] = [
        { key: "vendorName", label: "공급사명", value: parsed.vendorName, confidence: parsed.vendorName ? "high" : "blocked", reason: !parsed.vendorName ? "공급사명 추출 실패" : undefined },
        { key: "quoteDate", label: "견적일", value: parsed.quoteDate, confidence: parsed.quoteDate ? "high" : "review", reason: !parsed.quoteDate ? "견적일 미확인" : undefined },
        { key: "validUntil", label: "유효기간", value: parsed.validUntil, confidence: parsed.validUntil ? "high" : "review", reason: !parsed.validUntil ? "유효기간 미확인" : undefined },
        { key: "totalAmount", label: "총액", value: parsed.totalAmount, confidence: parsed.totalAmount ? "high" : "review", reason: !parsed.totalAmount ? "총액 추출 실패" : undefined },
        { key: "currency", label: "통화", value: parsed.currency ?? "KRW", confidence: parsed.currency ? "high" : "review" },
      ];

      const hasBlocker = fields.some((f) => f.confidence === "blocked");

      setIntakeSession((prev) =>
        prev
          ? {
              ...prev,
              status: hasBlocker ? "review" : "ready",
              supplierName: parsed.vendorName ?? undefined,
              parsedFields: fields,
              rawItems: parsed.items ?? [],
            }
          : prev,
      );

      if (parsed.vendorName) setManualSupplier(parsed.vendorName);
    } catch (err) {
      setIntakeSession((prev) =>
        prev
          ? { ...prev, status: "error", errorMessage: (err as Error).message }
          : prev,
      );
    }
  }, []);

  // ══════════════════════════════════════════
  // BOM Upload: 파일 → parse → staging review
  // ══════════════════════════════════════════
  const handleBomFileUpload = useCallback(async (file: File) => {
    const batchId = `bom_${Date.now()}`;
    setBomBatch({
      id: batchId,
      fileName: file.name,
      status: "uploading",
      items: [],
      groupingStrategy: "by_category",
      proposedCaseCount: 0,
    });

    try {
      setBomBatch((prev) => prev ? { ...prev, status: "parsing" } : prev);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/bom-parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("BOM 파싱 실패");

      const parsed = await res.json();
      const items: BomImportItem[] = (parsed.items ?? []).map((item: any, idx: number) => ({
        id: `bom_item_${idx}`,
        name: item.name ?? item.productName ?? `품목 ${idx + 1}`,
        catalogNumber: item.catalogNumber ?? item.cas,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "EA",
        category: item.category,
        normalized: !!item.name,
        suggestedGroup: item.category ?? "미분류",
      }));

      const categories = [...new Set(items.map((i) => i.suggestedGroup))];

      setBomBatch((prev) =>
        prev
          ? {
              ...prev,
              status: items.length > 0 ? "review" : "error",
              items,
              proposedCaseCount: categories.length,
              errorMessage: items.length === 0 ? "인식된 품목이 없습니다" : undefined,
            }
          : prev,
      );
    } catch (err) {
      setBomBatch((prev) =>
        prev
          ? { ...prev, status: "error", errorMessage: (err as Error).message }
          : prev,
      );
    }
  }, []);

  // ══════════════════════════════════════════
  // Commit: IntakeSession → QuoteCase 생성
  // ══════════════════════════════════════════
  const handleCommitManualUpload = useCallback(async () => {
    if (!intakeSession || intakeSession.status === "error") return;

    setCommitting(true);
    try {
      // 기존 케이스가 있으면 attach, 없으면 새 QuoteCase 생성
      const endpoint = existingCaseId
        ? `/api/quotes/${existingCaseId}/attach-document`
        : "/api/quotes/create-from-intake";

      const payload = {
        intakeSessionId: intakeSession.id,
        supplierName: manualSupplier || intakeSession.supplierName,
        project: manualProject,
        parsedFields: intakeSession.parsedFields,
        items: intakeSession.rawItems,
        fileName: intakeSession.fileName,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "전환 실패" }));
        throw new Error(err.message ?? "전환 실패");
      }

      toast.success(
        existingCaseId
          ? "견적서가 해당 케이스에 추가되었습니다"
          : "정식 견적 요청으로 전환되었습니다",
      );
      onCommitSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [intakeSession, existingCaseId, manualSupplier, manualProject, onCommitSuccess]);

  // ══════════════════════════════════════════
  // Commit: BomImportBatch → QuoteCase[] 생성
  // ══════════════════════════════════════════
  const handleCommitBom = useCallback(async () => {
    if (!bomBatch || bomBatch.status === "error") return;

    setCommitting(true);
    try {
      const payload = {
        batchId: bomBatch.id,
        items: bomBatch.items,
        project: bomBatch.project,
        requester: bomBatch.requester,
        groupingStrategy: bomBatch.groupingStrategy,
      };

      const res = await fetch("/api/quotes/create-from-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("BOM 전환 실패");

      const result = await res.json();
      toast.success(`견적 요청 ${result.createdCount ?? bomBatch.proposedCaseCount}건이 생성되었습니다`);
      onCommitSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [bomBatch, onCommitSuccess]);

  // ══════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════
  const confidenceBadge = (c: ParsedField["confidence"]) => {
    switch (c) {
      case "high":
        return <Badge className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">확인됨</Badge>;
      case "review":
        return <Badge className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200">검토 필요</Badge>;
      case "blocked":
        return <Badge className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">차단</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] md:w-[520px] p-0 overflow-y-auto !bg-white border-l border-slate-200"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50">
          <SheetTitle className="text-base font-bold text-slate-900">
            {source === "bom_import" ? "BOM 업로드" : "외부 견적서 업로드"}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            {source === "bom_import"
              ? "BOM 파일을 업로드하면 품목을 인식하고, 확인 후 견적 요청을 생성합니다."
              : existingCaseId
                ? "이 견적 케이스에 추가 견적서를 첨부합니다."
                : "견적서를 업로드하면 AI가 파싱하고, 확인 후 정식 견적 요청으로 전환합니다."}
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {source === "manual_upload" && (
            <>
              {/* ── Upload zone ── */}
              {!intakeSession && (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-blue-400", "bg-blue-50/50"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("border-blue-400", "bg-blue-50/50"); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-blue-400", "bg-blue-50/50");
                    const file = e.dataTransfer.files[0];
                    if (file) handleManualFileUpload(file);
                  }}
                >
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">견적서 파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, 이미지 파일 지원</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleManualFileUpload(file);
                    }}
                  />
                </div>
              )}

              {/* ── Uploading / Parsing state ── */}
              {intakeSession && (intakeSession.status === "uploading" || intakeSession.status === "parsing") && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-6 text-center">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">
                    {intakeSession.status === "uploading" ? "업로드 중..." : "AI 파싱 중..."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{intakeSession.fileName}</p>
                </div>
              )}

              {/* ── Error state ── */}
              {intakeSession?.status === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">파싱 실패</p>
                      <p className="text-xs text-red-500 mt-1">{intakeSession.errorMessage}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 h-8 text-xs border-red-200 text-red-600"
                        onClick={() => { setIntakeSession(null); fileInputRef.current?.click(); }}
                      >
                        다른 파일로 재시도
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Parse review ── */}
              {intakeSession && (intakeSession.status === "review" || intakeSession.status === "ready") && (
                <div className="space-y-4">
                  {/* File info */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{intakeSession.fileName}</p>
                      <p className="text-[10px] text-slate-400">{(intakeSession.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      className="text-slate-400 hover:text-slate-600"
                      onClick={() => { setIntakeSession(null); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Parsed fields */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">파싱 결과</p>
                    <div className="space-y-1.5">
                      {intakeSession.parsedFields.map((field) => (
                        <div key={field.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16 flex-shrink-0">{field.label}</span>
                            <span className="text-xs font-medium text-slate-700">{field.value ?? "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {field.reason && <span className="text-[10px] text-slate-400">{field.reason}</span>}
                            {confidenceBadge(field.confidence)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Items */}
                  {intakeSession.rawItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        인식된 품목 ({intakeSession.rawItems.length}건)
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
                        {intakeSession.rawItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50/50 text-xs">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-slate-700 truncate block">{item.name}</span>
                              {item.catalogNumber && <span className="text-[10px] text-slate-400">{item.catalogNumber}</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 text-slate-500">
                              {item.quantity && <span>{item.quantity} {item.unit ?? ""}</span>}
                              {item.unitPrice && <span className="font-medium text-slate-700">{item.unitPrice.toLocaleString()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mapping fields (케이스 없을 때만) */}
                  {!existingCaseId && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">매핑 정보</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">공급사명</label>
                          <Input
                            value={manualSupplier}
                            onChange={(e) => setManualSupplier(e.target.value)}
                            placeholder="공급사명 입력 또는 확인"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">프로젝트 (선택)</label>
                          <Input
                            value={manualProject}
                            onChange={(e) => setManualProject(e.target.value)}
                            placeholder="프로젝트명"
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commit CTA */}
                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      className="w-full h-10 gap-2 bg-blue-600 hover:bg-blue-700"
                      disabled={committing || (!existingCaseId && !manualSupplier)}
                      onClick={handleCommitManualUpload}
                    >
                      {committing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {existingCaseId ? "견적서 추가" : "정식 요청으로 전환"}
                    </Button>
                    {!existingCaseId && (
                      <p className="text-[10px] text-slate-400 text-center mt-2">
                        전환 전까지는 워크큐에 반영되지 않습니다
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {source === "bom_import" && (
            <>
              {/* ── BOM Upload zone ── */}
              {!bomBatch && (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"
                  onClick={() => bomFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50/50"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/50"); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/50");
                    const file = e.dataTransfer.files[0];
                    if (file) handleBomFileUpload(file);
                  }}
                >
                  <Table2 className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">BOM 파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-slate-400 mt-1">Excel, CSV, PDF 형식 지원</p>
                  <input
                    ref={bomFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBomFileUpload(file);
                    }}
                  />
                </div>
              )}

              {/* ── BOM Parsing ── */}
              {bomBatch && (bomBatch.status === "uploading" || bomBatch.status === "parsing") && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6 text-center">
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">BOM 파싱 중...</p>
                  <p className="text-xs text-slate-400 mt-1">{bomBatch.fileName}</p>
                </div>
              )}

              {/* ── BOM Error ── */}
              {bomBatch?.status === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">BOM 파싱 실패</p>
                      <p className="text-xs text-red-500 mt-1">{bomBatch.errorMessage}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 h-8 text-xs border-red-200 text-red-600"
                        onClick={() => { setBomBatch(null); bomFileInputRef.current?.click(); }}
                      >
                        다른 파일로 재시도
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── BOM Review ── */}
              {bomBatch && (bomBatch.status === "review" || bomBatch.status === "ready") && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Package className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{bomBatch.fileName}</p>
                      <p className="text-[10px] text-emerald-600">
                        {bomBatch.items.length}개 품목 인식 → {bomBatch.proposedCaseCount}건 견적 요청 예정
                      </p>
                    </div>
                  </div>

                  {/* Mapping fields */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">프로젝트</label>
                      <Input
                        value={bomBatch.project ?? ""}
                        onChange={(e) => setBomBatch((prev) => prev ? { ...prev, project: e.target.value } : prev)}
                        placeholder="프로젝트명"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">요청자</label>
                      <Input
                        value={bomBatch.requester ?? ""}
                        onChange={(e) => setBomBatch((prev) => prev ? { ...prev, requester: e.target.value } : prev)}
                        placeholder="요청자명"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Grouping strategy */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">분할 전략</p>
                    <div className="flex gap-2">
                      {(["by_category", "by_supplier", "single"] as const).map((strategy) => {
                        const labels = { by_category: "품목군별", by_supplier: "공급사별", single: "단일 요청" };
                        return (
                          <button
                            key={strategy}
                            onClick={() => {
                              setBomBatch((prev) => {
                                if (!prev) return prev;
                                const count = strategy === "single"
                                  ? 1
                                  : new Set(prev.items.map((i) => i.suggestedGroup)).size;
                                return { ...prev, groupingStrategy: strategy, proposedCaseCount: count };
                              });
                            }}
                            className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                              bomBatch.groupingStrategy === strategy
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                            )}
                          >
                            {labels[strategy]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Items list */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      인식된 품목 ({bomBatch.items.length}건)
                    </p>
                    <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
                      {bomBatch.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50/50 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-700 truncate block">{item.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.catalogNumber && <span className="text-[10px] text-slate-400">{item.catalogNumber}</span>}
                              {item.suggestedGroup && (
                                <Badge className="text-[9px] px-1 py-0 bg-slate-100 text-slate-500 border-slate-200">{item.suggestedGroup}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-slate-500">{item.quantity} {item.unit}</span>
                            {!item.normalized && (
                              <Badge className="text-[9px] px-1 py-0 bg-amber-50 text-amber-600 border-amber-200">검토</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Commit */}
                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      className="w-full h-10 gap-2 bg-blue-600 hover:bg-blue-700"
                      disabled={committing || !bomBatch.project}
                      onClick={handleCommitBom}
                    >
                      {committing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      요청 생성 ({bomBatch.proposedCaseCount}건)
                    </Button>
                    <p className="text-[10px] text-slate-400 text-center mt-2">
                      생성 전까지는 워크큐에 반영되지 않습니다 (staging)
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
