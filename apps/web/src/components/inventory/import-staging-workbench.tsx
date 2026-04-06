"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Check, XCircle,
  ChevronDown, ChevronRight, AlertTriangle, ArrowRight, Shield, Search,
  FileText, Sparkles, RotateCcw, Download, Loader2, Eye, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type ImportStagingState, type ParsedImportRow, type ColumnMappingResult, type RowDecision, type ImportMode,
  createInitialImportStagingState, simulateAIColumnMapping, validateImportRow, detectDuplicates,
  computeConfidenceSummary, computeIssueSummary, validateImportStagingBeforeApply, buildImportApplyPayload,
  buildImportAuditEntry, IMPORT_TARGET_FIELDS, classifyConfidence,
} from "@/lib/ai/inventory-import-staging-engine";

// ── Types ──
type StagingStep = "upload" | "mapping" | "review" | "apply";

interface ImportStagingWorkbenchProps {
  open: boolean;
  onClose: () => void;
  onApplyComplete?: (auditId: string) => void;
}

// ── Mock data generator for demo ──
function generateMockRows(columns: string[], mappings: ColumnMappingResult[]): ParsedImportRow[] {
  const sampleData = [
    { "시약명": "Gibco FBS (500ml)", "카탈로그번호": "16000-044", "제조사": "Thermo Fisher", "수량": "5", "단위": "개", "Lot 번호": "24A01-X", "유효기한": "2027-06-30", "보관위치": "냉동고 1칸", "안전재고": "10", "비고": "" },
    { "시약명": "DMEM Medium (500ml)", "카탈로그번호": "D5671", "제조사": "Sigma-Aldrich", "수량": "3", "단위": "개", "Lot 번호": "25B12-M", "유효기한": "2026-12-15", "보관위치": "냉장고 2칸", "안전재고": "5", "비고": "긴급 보충 필요" },
    { "시약명": "Trypsin-EDTA", "카탈로그번호": "25200-056", "제조사": "Gibco", "수량": "12", "단위": "개", "Lot 번호": "24K09-Z", "유효기한": "2027-03-20", "보관위치": "냉장고 3칸", "안전재고": "8", "비고": "" },
    { "시약명": "Falcon 50ml Tube", "카탈로그번호": "352070", "제조사": "Corning", "수량": "200", "단위": "개", "Lot 번호": "", "유효기한": "", "보관위치": "선반 3층", "안전재고": "50", "비고": "" },
    { "시약명": "", "카탈로그번호": "CAT-UNKNOWN", "제조사": "", "수량": "-2", "단위": "", "Lot 번호": "", "유효기한": "invalid-date", "보관위치": "", "안전재고": "", "비고": "문제 행" },
    { "시약명": "Gibco FBS (500ml)", "카탈로그번호": "16000-044", "제조사": "Thermo Fisher", "수량": "3", "단위": "개", "Lot 번호": "23K15-Y", "유효기한": "2026-03-15", "보관위치": "냉동고 1칸", "안전재고": "10", "비고": "중복 확인 필요" },
    { "시약명": "PBS Buffer (1L)", "카탈로그번호": "10010-023", "제조사": "Gibco", "수량": "8", "단위": "bottle", "Lot 번호": "25C03-A", "유효기한": "2028-01-01", "보관위치": "상온 선반", "안전재고": "4", "비고": "" },
  ];

  const fieldMap = new Map<string, string>();
  for (const m of mappings) {
    if (m.targetField) fieldMap.set(m.sourceColumn, m.targetField);
  }

  const rows: ParsedImportRow[] = sampleData.map((raw, idx) => {
    const getMapped = (field: string) => {
      for (const [src, tgt] of fieldMap) {
        if (tgt === field) return raw[src as keyof typeof raw] || null;
      }
      return null;
    };
    const qtyStr = getMapped("quantity");
    const qty = qtyStr ? parseFloat(qtyStr) : null;
    const ssStr = getMapped("safetyStock");
    const moqStr = getMapped("minOrderQty");

    const mapped = {
      productName: getMapped("productName"),
      catalogNumber: getMapped("catalogNumber"),
      brand: getMapped("brand"),
      lotNumber: getMapped("lotNumber"),
      quantity: isNaN(qty as number) ? null : qty,
      unit: getMapped("unit"),
      expiryDate: getMapped("expiryDate"),
      location: getMapped("location"),
      storageCondition: null,
      safetyStock: ssStr ? parseFloat(ssStr) : null,
      minOrderQty: moqStr ? parseFloat(moqStr) : null,
      notes: getMapped("notes"),
    };

    const avgConfidence = mappings.filter(m => m.targetField).reduce((s, m) => s + m.confidence, 0) / Math.max(1, mappings.filter(m => m.targetField).length);
    const rowConf = mapped.productName ? avgConfidence * (mapped.quantity !== null && mapped.quantity >= 0 ? 1 : 0.5) : 0.1;

    const parsedRow: ParsedImportRow = {
      rowIndex: idx,
      rawData: raw as unknown as Record<string, string>,
      mappedData: mapped,
      rowConfidence: Math.min(1, Math.max(0, rowConf)),
      rowConfidenceLevel: classifyConfidence(Math.min(1, Math.max(0, rowConf))),
      issues: [],
      operatorDecision: "pending",
      matchedInventoryId: idx < 3 ? `existing-inv-${idx}` : null,
      matchedProductId: idx < 4 ? `existing-prod-${idx}` : null,
      isNewItem: idx >= 4 && idx !== 5,
      isDuplicate: false,
      duplicateOfRowIndex: null,
    };

    parsedRow.issues = validateImportRow(parsedRow);
    return parsedRow;
  });

  return detectDuplicates(rows);
}

// ── Component ──
export function ImportStagingWorkbench({ open, onClose, onApplyComplete }: ImportStagingWorkbenchProps) {
  const [step, setStep] = useState<StagingStep>("upload");
  const [stagingState, setStagingState] = useState<ImportStagingState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "errors" | "warnings" | "low_confidence" | "new_items" | "duplicates">("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => stagingState ? validateImportStagingBeforeApply(stagingState) : null, [stagingState]);

  // ── File upload handler ──
  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    const state = createInitialImportStagingState({ name: file.name, size: file.size, id: `file_${Date.now()}` });
    state.importStagingStatus = "ai_parsing";
    state.substatus = "parsing_in_progress";
    setStagingState(state);

    // Simulate AI parsing delay
    await new Promise(r => setTimeout(r, 1200));

    const columns = ["시약명", "카탈로그번호", "제조사", "수량", "단위", "Lot 번호", "유효기한", "보관위치", "안전재고", "비고"];
    const mappings = simulateAIColumnMapping(columns);
    const rows = generateMockRows(columns, mappings);
    const confSummary = computeConfidenceSummary(rows);
    const issueSummary = computeIssueSummary(rows);

    setStagingState(prev => prev ? {
      ...prev,
      importStagingStatus: "ai_mapping_complete",
      substatus: "review_ready",
      totalRowCount: rows.length,
      parsedRowCount: rows.length,
      columnMappings: mappings,
      rows,
      ...confSummary,
      highConfidenceCount: confSummary.high,
      mediumConfidenceCount: confSummary.medium,
      lowConfidenceCount: confSummary.low,
      unmappedCount: confSummary.unmapped,
      ...issueSummary,
      errorCount: issueSummary.errors,
      warningCount: issueSummary.warnings,
      duplicateCount: issueSummary.duplicates,
      newItemCount: issueSummary.newItems,
      pendingDecisionCount: rows.length,
    } : prev);

    setStep("mapping");
    setIsProcessing(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files[0]);
  }, [handleFileUpload]);

  // ── Row decision handler ──
  const setRowDecision = useCallback((rowIndex: number, decision: RowDecision) => {
    setStagingState(prev => {
      if (!prev) return prev;
      const newRows = prev.rows.map(r => r.rowIndex === rowIndex ? { ...r, operatorDecision: decision } : r);
      const approved = newRows.filter(r => r.operatorDecision === "approved").length;
      const rejected = newRows.filter(r => r.operatorDecision === "rejected").length;
      const corrected = newRows.filter(r => r.operatorDecision === "corrected").length;
      const pending = newRows.filter(r => r.operatorDecision === "pending").length;
      return {
        ...prev, rows: newRows,
        approvedCount: approved, rejectedCount: rejected, correctedCount: corrected, pendingDecisionCount: pending,
        importStagingStatus: "operator_reviewing", substatus: pending > 0 ? "review_in_progress" : "ready_to_apply",
      };
    });
  }, []);

  // ── Bulk approve high-confidence rows ──
  const bulkApproveHighConfidence = useCallback(() => {
    setStagingState(prev => {
      if (!prev) return prev;
      const newRows = prev.rows.map(r => {
        if (r.operatorDecision === "pending" && r.rowConfidenceLevel === "high" && !r.issues.some(i => i.severity === "error")) {
          return { ...r, operatorDecision: "approved" as RowDecision };
        }
        return r;
      });
      const approved = newRows.filter(r => r.operatorDecision === "approved").length;
      const pending = newRows.filter(r => r.operatorDecision === "pending").length;
      return { ...prev, rows: newRows, approvedCount: approved, pendingDecisionCount: pending, importStagingStatus: "operator_reviewing", substatus: pending > 0 ? "review_in_progress" : "ready_to_apply" };
    });
  }, []);

  // ── Apply handler ──
  const handleApply = useCallback(async () => {
    if (!stagingState || !validation?.canApply) return;
    setIsProcessing(true);
    setStagingState(prev => prev ? { ...prev, importStagingStatus: "applying", substatus: "apply_in_progress" } : prev);

    await new Promise(r => setTimeout(r, 1500));

    const payload = buildImportApplyPayload(stagingState);
    const audit = buildImportAuditEntry(stagingState, "current_user");

    setStagingState(prev => prev ? {
      ...prev, importStagingStatus: "applied", substatus: "apply_complete",
      appliedCount: payload.totalApplyCount, importAuditId: audit.id,
    } : prev);
    setStep("apply");
    setIsProcessing(false);
    onApplyComplete?.(audit.id);
  }, [stagingState, validation, onApplyComplete]);

  // ── Filtered rows for review ──
  const filteredRows = useMemo(() => {
    if (!stagingState) return [];
    const rows = stagingState.rows;
    switch (reviewFilter) {
      case "errors": return rows.filter(r => r.issues.some(i => i.severity === "error"));
      case "warnings": return rows.filter(r => r.issues.some(i => i.severity === "warning"));
      case "low_confidence": return rows.filter(r => r.rowConfidenceLevel === "low" || r.rowConfidenceLevel === "unmapped");
      case "new_items": return rows.filter(r => r.isNewItem);
      case "duplicates": return rows.filter(r => r.isDuplicate);
      default: return rows;
    }
  }, [stagingState, reviewFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border border-bd rounded-2xl shadow-2xl w-full max-w-[1160px] max-h-[88vh] overflow-hidden flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bd bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/25">
              <FileSpreadsheet className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">재고 파일 가져오기</h2>
                {stagingState && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    stagingState.importStagingStatus === "applied" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                    stagingState.importStagingStatus === "operator_reviewing" ? "bg-blue-500/10 text-blue-400 border-blue-500/25" :
                    "bg-slate-500/10 text-slate-400 border-slate-500/25"
                  }`}>
                    {stagingState.importStagingStatus === "ai_parsing" ? "AI 분석 중" :
                     stagingState.importStagingStatus === "ai_mapping_complete" ? "매핑 완료" :
                     stagingState.importStagingStatus === "operator_reviewing" ? "검토 중" :
                     stagingState.importStagingStatus === "applying" ? "적용 중" :
                     stagingState.importStagingStatus === "applied" ? "적용 완료" : "대기"}
                  </Badge>
                )}
              </div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                <span className={step === "upload" ? "text-blue-400 font-medium" : stagingState ? "text-slate-600" : ""}>파일 업로드</span>
                <ChevronRight className="h-3 w-3" />
                <span className={step === "mapping" ? "text-blue-400 font-medium" : step === "review" || step === "apply" ? "text-slate-600" : ""}>AI 매핑 검토</span>
                <ChevronRight className="h-3 w-3" />
                <span className={step === "review" ? "text-blue-400 font-medium" : step === "apply" ? "text-slate-600" : ""}>데이터 검토</span>
                <ChevronRight className="h-3 w-3" />
                <span className={step === "apply" ? "text-emerald-400 font-medium" : ""}>적용</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-600 hover:bg-white/[0.05]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <section>
                <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Upload className="h-4 w-4 text-blue-400" />
                  파일 선택
                </h3>
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                    isProcessing ? "border-blue-500/40 bg-blue-600/5" : "border-bd/60 hover:border-blue-500/40 hover:bg-blue-600/[0.02]"
                  }`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
                  {isProcessing ? (
                    <div className="space-y-3">
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
                      <p className="text-sm text-blue-300 font-medium">AI가 파일을 분석하고 있습니다...</p>
                      <p className="text-xs text-slate-500">컬럼 구조 파악 · 데이터 타입 추론 · 필드 매핑</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-slate-500" />
                        <Sparkles className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-700 font-medium">파일을 드래그하거나 클릭하여 선택</p>
                        <p className="text-xs text-slate-500 mt-1">XLSX, XLS, CSV · AI가 자동으로 컬럼을 분석하고 매핑합니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="px-4 py-3 rounded-lg bg-blue-600/[0.04] border border-blue-500/15">
                <div className="flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-blue-300 font-medium">안전한 가져오기</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">AI가 파일을 분석한 뒤 매핑 결과를 먼저 보여드립니다. 검토 후 승인한 항목만 재고에 반영됩니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mapping Review */}
          {step === "mapping" && stagingState && (
            <div className="space-y-5">
              {/* File info */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-bd/40">
                <FileText className="h-4 w-4 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700 font-medium truncate block">{stagingState.fileName}</span>
                  <span className="text-[11px] text-slate-500">{stagingState.totalRowCount}행 · {(stagingState.fileSize / 1024).toFixed(1)}KB</span>
                </div>
                <Select value={stagingState.importMode} onValueChange={(v: ImportMode) => setStagingState(prev => prev ? { ...prev, importMode: v } : prev)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge">병합 (Merge)</SelectItem>
                    <SelectItem value="append">추가 (Append)</SelectItem>
                    <SelectItem value="overwrite">덮어쓰기</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Mapping Results */}
              <section>
                <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  AI 컬럼 매핑 결과
                </h3>
                <div className="space-y-1.5">
                  {stagingState.columnMappings.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-bd/30 bg-slate-50/60">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-600 font-medium">{m.sourceColumn}</span>
                      </div>
                      <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
                      <div className="w-[140px]">
                        <Select
                          value={m.operatorOverride || m.targetField || "skip"}
                          onValueChange={v => {
                            setStagingState(prev => {
                              if (!prev) return prev;
                              const newMappings = [...prev.columnMappings];
                              newMappings[i] = { ...newMappings[i], operatorOverride: v === "skip" ? "" : v };
                              return { ...prev, columnMappings: newMappings };
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue placeholder="건너뛰기" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">건너뛰기</SelectItem>
                            {IMPORT_TARGET_FIELDS.map(f => (
                              <SelectItem key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[80px] flex items-center justify-end gap-1">
                        <div className={`h-1.5 rounded-full ${
                          m.confidenceLevel === "high" ? "bg-emerald-500" :
                          m.confidenceLevel === "medium" ? "bg-blue-500" :
                          m.confidenceLevel === "low" ? "bg-amber-500" :
                          "bg-slate-600"
                        }`} style={{ width: `${Math.max(8, m.confidence * 60)}px` }} />
                        <span className={`text-[10px] font-mono ${
                          m.confidenceLevel === "high" ? "text-emerald-400" :
                          m.confidenceLevel === "medium" ? "text-blue-400" :
                          m.confidenceLevel === "low" ? "text-amber-400" :
                          "text-slate-600"
                        }`}>{Math.round(m.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Confidence Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="px-3 py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-600/[0.03] text-center">
                  <span className="text-[9px] text-slate-500 block">고신뢰</span>
                  <span className="text-lg font-bold text-emerald-400">{stagingState.highConfidenceCount}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-blue-500/20 bg-blue-600/[0.03] text-center">
                  <span className="text-[9px] text-slate-500 block">중간</span>
                  <span className="text-lg font-bold text-blue-400">{stagingState.mediumConfidenceCount}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-amber-500/20 bg-amber-600/[0.03] text-center">
                  <span className="text-[9px] text-slate-500 block">저신뢰</span>
                  <span className="text-lg font-bold text-amber-400">{stagingState.lowConfidenceCount}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-bd/40 bg-slate-50 text-center">
                  <span className="text-[9px] text-slate-500 block">미매핑</span>
                  <span className="text-lg font-bold text-slate-500">{stagingState.unmappedCount}</span>
                </div>
              </div>

              {/* Issue Summary */}
              {(stagingState.errorCount > 0 || stagingState.warningCount > 0 || stagingState.duplicateCount > 0 || stagingState.newItemCount > 0) && (
                <div className="flex flex-wrap gap-2">
                  {stagingState.errorCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600/[0.06] border border-red-500/15">
                      <AlertCircle className="h-3 w-3 text-red-400" />
                      <span className="text-[11px] text-red-300">오류 {stagingState.errorCount}건</span>
                    </div>
                  )}
                  {stagingState.warningCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-[11px] text-amber-300">경고 {stagingState.warningCount}건</span>
                    </div>
                  )}
                  {stagingState.duplicateCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/[0.04] border border-blue-500/10">
                      <Eye className="h-3 w-3 text-blue-400" />
                      <span className="text-[11px] text-blue-300">중복 의심 {stagingState.duplicateCount}건</span>
                    </div>
                  )}
                  {stagingState.newItemCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-600/[0.04] border border-purple-500/10">
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      <span className="text-[11px] text-purple-300">신규 품목 {stagingState.newItemCount}건</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Data Review */}
          {(step === "review" || (step === "mapping" && stagingState)) && stagingState && step !== "apply" && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-400" />
                  데이터 검토
                </h3>
                <div className="flex items-center gap-2">
                  <Select value={reviewFilter} onValueChange={v => setReviewFilter(v as typeof reviewFilter)}>
                    <SelectTrigger className="h-7 w-[130px] text-[11px]">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 ({stagingState.totalRowCount})</SelectItem>
                      <SelectItem value="errors">오류 ({stagingState.errorCount})</SelectItem>
                      <SelectItem value="warnings">경고 ({stagingState.warningCount})</SelectItem>
                      <SelectItem value="low_confidence">저신뢰 ({stagingState.lowConfidenceCount})</SelectItem>
                      <SelectItem value="new_items">신규 ({stagingState.newItemCount})</SelectItem>
                      <SelectItem value="duplicates">중복 ({stagingState.duplicateCount})</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20" onClick={bulkApproveHighConfidence}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    고신뢰 일괄 승인
                  </Button>
                </div>
              </div>

              {/* Row list */}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {filteredRows.map(row => {
                  const hasErrors = row.issues.some(i => i.severity === "error");
                  const hasWarnings = row.issues.some(i => i.severity === "warning");
                  const isExpanded = expandedRows.has(row.rowIndex);

                  return (
                    <div key={row.rowIndex} className={`rounded-lg border transition-colors ${
                      row.operatorDecision === "approved" ? "border-emerald-500/20 bg-emerald-600/[0.02]" :
                      row.operatorDecision === "rejected" ? "border-red-500/20 bg-red-600/[0.02] opacity-60" :
                      hasErrors ? "border-red-500/25 bg-red-600/[0.03]" :
                      hasWarnings ? "border-amber-500/15 bg-amber-600/[0.02]" :
                      "border-bd/30 bg-slate-50/60"
                    }`}>
                      {/* Row summary */}
                      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => setExpandedRows(prev => { const s = new Set(prev); s.has(row.rowIndex) ? s.delete(row.rowIndex) : s.add(row.rowIndex); return s; })}>
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />}
                        <span className="text-[10px] text-slate-600 font-mono w-6">#{row.rowIndex + 1}</span>
                        <span className="text-sm text-slate-700 font-medium flex-1 min-w-0 truncate">
                          {row.mappedData.productName || <span className="text-red-400 italic">제품명 없음</span>}
                        </span>
                        {row.mappedData.catalogNumber && <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">{row.mappedData.catalogNumber}</span>}
                        {row.mappedData.quantity !== null && (
                          <span className="text-xs text-slate-600">{row.mappedData.quantity} {row.mappedData.unit || ""}</span>
                        )}
                        {/* Badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {row.isNewItem && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">신규</Badge>}
                          {row.isDuplicate && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">중복</Badge>}
                          {hasErrors && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-500/10 text-red-400 border-red-500/20">오류</Badge>}
                          {/* Confidence */}
                          <span className={`text-[9px] font-mono ${
                            row.rowConfidenceLevel === "high" ? "text-emerald-400" :
                            row.rowConfidenceLevel === "medium" ? "text-blue-400" :
                            row.rowConfidenceLevel === "low" ? "text-amber-400" : "text-slate-600"
                          }`}>{Math.round(row.rowConfidence * 100)}%</span>
                        </div>
                        {/* Decision buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setRowDecision(row.rowIndex, "approved"); }}
                            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
                              row.operatorDecision === "approved" ? "bg-emerald-600/30 text-emerald-400" : "text-slate-600 hover:text-emerald-400 hover:bg-emerald-600/10"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setRowDecision(row.rowIndex, "rejected"); }}
                            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
                              row.operatorDecision === "rejected" ? "bg-red-600/30 text-red-400" : "text-slate-600 hover:text-red-400 hover:bg-red-600/10"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-bd/20 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
                            {row.mappedData.brand && <div><span className="text-slate-500">제조사:</span> <span className="text-slate-600">{row.mappedData.brand}</span></div>}
                            {row.mappedData.lotNumber && <div><span className="text-slate-500">Lot:</span> <span className="text-slate-600 font-mono">{row.mappedData.lotNumber}</span></div>}
                            {row.mappedData.expiryDate && <div><span className="text-slate-500">유효기한:</span> <span className="text-slate-600">{row.mappedData.expiryDate}</span></div>}
                            {row.mappedData.location && <div><span className="text-slate-500">위치:</span> <span className="text-slate-600">{row.mappedData.location}</span></div>}
                            {row.mappedData.safetyStock !== null && <div><span className="text-slate-500">안전재고:</span> <span className="text-slate-600">{row.mappedData.safetyStock}</span></div>}
                            {row.mappedData.notes && <div className="col-span-2"><span className="text-slate-500">비고:</span> <span className="text-slate-600">{row.mappedData.notes}</span></div>}
                          </div>
                          {row.issues.length > 0 && (
                            <div className="space-y-1">
                              {row.issues.map((issue, ii) => (
                                <div key={ii} className={`flex items-center gap-1.5 text-[11px] ${
                                  issue.severity === "error" ? "text-red-400" : issue.severity === "warning" ? "text-amber-400" : "text-slate-500"
                                }`}>
                                  {issue.severity === "error" ? <AlertCircle className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
                                  {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                          {row.matchedInventoryId && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              기존 재고 매칭됨 — 병합 대상
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Step 4: Apply Complete */}
          {step === "apply" && stagingState && (
            <div className="px-4 py-8 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/15 border border-emerald-500/25 mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">가져오기 완료</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {stagingState.appliedCount}건 적용 · {stagingState.rejectedCount}건 제외
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                <div className="px-3 py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-600/[0.03] text-center">
                  <span className="text-[9px] text-slate-500 block">적용</span>
                  <span className="text-lg font-bold text-emerald-400">{stagingState.appliedCount}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-600/[0.03] text-center">
                  <span className="text-[9px] text-slate-500 block">제외</span>
                  <span className="text-lg font-bold text-red-400">{stagingState.rejectedCount}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-bd/40 bg-slate-50 text-center">
                  <span className="text-[9px] text-slate-500 block">전체</span>
                  <span className="text-lg font-bold text-slate-600">{stagingState.totalRowCount}</span>
                </div>
              </div>
              {stagingState.importAuditId && (
                <p className="text-[11px] text-slate-600 font-mono">Audit: {stagingState.importAuditId}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Dock ── */}
        <div className="px-6 py-3 border-t border-bd bg-white">
          {/* Status strip */}
          {stagingState && step !== "apply" && (
            <div className="flex items-center gap-3 text-[10px] mb-2.5">
              <span className="text-slate-500">전체 <span className="text-slate-600 font-medium">{stagingState.totalRowCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">승인 <span className="text-emerald-400 font-medium">{stagingState.approvedCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">제외 <span className="text-red-400 font-medium">{stagingState.rejectedCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">미결정 <span className="text-slate-600 font-medium">{stagingState.pendingDecisionCount}</span></span>
              {validation && <span className="text-slate-600">·</span>}
              {validation && <span className="text-slate-500">{validation.recommendedNextAction}</span>}
            </div>
          )}

          <div className="flex gap-2">
            {step === "upload" && (
              <Button size="sm" variant="ghost" className="h-10 px-4 text-sm text-slate-400 hover:text-slate-600 border border-bd/40" onClick={onClose}>
                닫기
              </Button>
            )}

            {step === "mapping" && (
              <>
                <Button size="sm" variant="ghost" className="h-10 px-4 text-sm text-slate-400 hover:text-slate-600 border border-bd/40" onClick={() => { setStep("upload"); setStagingState(null); }}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  다시 선택
                </Button>
                <Button size="sm" className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold" onClick={() => setStep("review")}>
                  데이터 검토로 진행
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </>
            )}

            {step === "review" && (
              <>
                <Button size="sm" variant="ghost" className="h-10 px-4 text-sm text-slate-400 hover:text-slate-600 border border-bd/40" onClick={() => setStep("mapping")}>
                  매핑 수정
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 h-10 text-sm font-semibold ${validation?.canApply ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400 cursor-not-allowed"}`}
                  onClick={handleApply}
                  disabled={!validation?.canApply || isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />적용 중...</>
                  ) : validation?.canApply ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />재고에 적용 ({stagingState?.approvedCount ?? 0}건)</>
                  ) : (
                    <>{validation?.blockingIssues[0] || "검토 미완료"}</>
                  )}
                </Button>
              </>
            )}

            {step === "apply" && (
              <Button size="sm" className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold" onClick={onClose}>
                완료
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
