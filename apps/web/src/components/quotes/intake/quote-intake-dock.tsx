"use client";

/**
 * QuoteIntakeDock — Quotes Work Queue 내부 intake capability
 *
 * Smart Sourcing를 독립 페이지 대신 same-canvas right dock로 통합.
 *
 * §11.55 — manual_upload 분기 제거 (backend `/api/quotes/create-from-intake`
 * + `/api/quotes/[id]/attach-document` 미구현으로 dead-end UI였음).
 * 현재는 BOM import 단일 source.
 *
 *  - bom_import: BOM 업로드 → BomImportBatch staging → commit
 *
 * 원칙:
 *  - queue row는 commit 시점에만 생성
 *  - BomImportBatch는 staging only
 *  - parser 결과는 derived snapshot (원본 immutable)
 *  - same-canvas dock 안에서만 동작, 별도 페이지 금지
 */

import { useState, useCallback, useRef } from "react";
import { csrfFetch } from "@/lib/api-client";
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
  source: "bom_import" | null;
  onCommitSuccess?: () => void;
}

export function QuoteIntakeDock({
  open,
  onOpenChange,
  source,
  onCommitSuccess,
}: QuoteIntakeDockProps) {
  // ── BOM import state ──
  const [bomBatch, setBomBatch] = useState<BomImportBatch | null>(null);
  const bomFileInputRef = useRef<HTMLInputElement>(null);

  // ── Common ──
  const [committing, setCommitting] = useState(false);

  const resetState = useCallback(() => {
    setBomBatch(null);
    setCommitting(false);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // 닫을 때 staging 초기화
    setTimeout(resetState, 300);
  }, [onOpenChange, resetState]);

  // ══════════════════════════════════════════
  // §11.55 — Manual upload handlers (handleManualFileUpload,
  // handleCommitManualUpload) removed: backend endpoints
  // (`/api/quotes/parse-pdf` exists but `/api/quotes/create-from-intake`
  // and `/api/quotes/[id]/attach-document` do NOT exist) made the
  // entire flow a 404 dead-end. LabAxis 견적 응답 표준 워크플로우는
  // Path 1 (vendor token 응답 링크) + Path 2 (SendGrid inbound webhook)
  // 자동 처리이며 manual upload 시나리오는 운영 ontology에 없음.
  // ══════════════════════════════════════════

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

      const res = await csrfFetch("/api/ai/bom-parse", {
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

      const res = await csrfFetch("/api/quotes/create-from-bom", {
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

  // §11.55 — confidenceBadge helper + ParsedField type 제거: manual upload
  // 분기에서만 쓰던 dead code.

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] md:w-[520px] p-0 overflow-y-auto !bg-white border-l border-slate-200"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50">
          <SheetTitle className="text-base font-bold text-slate-900">BOM 업로드</SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            BOM 파일을 업로드하면 품목을 인식하고, 확인 후 견적 요청을 생성합니다.
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-5">
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
                              <Badge className="text-[9px] px-1 py-0 bg-yellow-50 text-yellow-600 border-yellow-200">검토</Badge>
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
