"use client";

/**
 * §receiving-doc-attach-canonical (T1) — 입고 문서 첨부 모달 (canonical 배선).
 *
 * 이력:
 *   - §receiving-doc-attach-v2(2026-07-08): same-canvas 센터 Dialog 폼팩터 확립.
 *     당시 파일 실업로드는 "입고 DB 연동 후 제공" 으로 정직-disabled 처리했다.
 *   - 본 트랙(T1)이 그 "입고 DB 연동" 이다 → 실업로드로 승격(supersede).
 *
 * 핸드오프 §0 대응(release blocker):
 *   1. "추가" front-only 제거 — 파일 선택기 → 진행률(취소 가능) → **서버 2xx 확인 후에만** 첨부됨.
 *   2. MSDS 허위 표시 제거 — 품목 문서(SDSDocument.productId, 현행 유효본)에서만 파생.
 *      데모 seed 첨부 플래그 참조 0.
 *
 * 범위(T1) 경계 — 정직 표기:
 *   - 입고 건(PO) 단위 증빙(거래명세서·기타) = ReceivingDocument 실업로드.
 *   - CoA 는 lot-scoped(SDSDocument.restockId 필수 = 입고 확정 이후) → 검수 중 첨부는 T2 소관.
 *     여기서는 "입고 확정 후 첨부" 로 사유를 명시한다(가짜 버튼 금지).
 *   - 발주(Order) 미해석 시 업로드 비활성 + 사유 표기(dead button 0).
 *
 * ⚠ GMP 보존: 문서 요구 granularity(라인/lot)는 표시로 유지. CoA lot 결속은 T2에서 canonical 배선.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, CheckCircle2, AlertTriangle, Upload, X, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceivingBatchContract } from "@/lib/review-queue/receiving-inbound-contract";
import { labToast } from "@/lib/toast/lab-toast";
import {
  useReceivingDocuments,
  useResolvedOrderId,
  uploadReceivingDocumentWithProgress,
  type ReceivingDocumentItem,
} from "@/hooks/use-receiving-documents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rb: ReceivingBatchContract;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 표기 통일: YYYY. M. D. {실명} 첨부 */
function formatAttachedLine(doc: ReceivingDocumentItem): string {
  const d = new Date(doc.uploadedAt);
  const date = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  return [date, doc.uploadedBy].filter(Boolean).join(" ") + (date ? " 첨부" : "");
}

export function ReceivingDocAttachModal({ open, onOpenChange, rb }: Props) {
  // 데모 배치의 poId → 실제 Order.id 해석(§11.211 Path V 선례). 미해석 = 발주 미연결.
  const { orderId, isResolving } = useResolvedOrderId(open ? rb.poId : null);
  const { documents, isLoading, isError, removeDocument, invalidate } =
    useReceivingDocuments(open ? orderId : null);

  const [uploading, setUploading] = useState<{ name: string; percent: number } | null>(null);
  const abortRef = useRef<null | (() => void)>(null);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const etcInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const invoiceDocs = useMemo(() => documents.filter((d) => d.docType === "invoice"), [documents]);
  const etcDocs = useMemo(() => documents.filter((d) => d.docType !== "invoice"), [documents]);
  const attachedCount = documents.length;
  const uploadingCount = uploading ? 1 : 0;

  const canUpload = Boolean(orderId) && !uploading;

  const handlePick = async (file: File | undefined, docType: "invoice" | "etc") => {
    if (!file || !orderId) return;
    setUploading({ name: file.name, percent: 0 });
    const { promise, abort } = uploadReceivingDocumentWithProgress({
      orderId,
      file,
      docType,
      onProgress: (percent) => setUploading((prev) => (prev ? { ...prev, percent } : prev)),
    });
    abortRef.current = abort;
    try {
      await promise; // 서버 2xx 확인 — 여기 도달해야만 첨부됨 상태.
      await invalidate();
      labToast.success("문서 첨부 완료", `<b>${file.name}</b> 이(가) 첨부되었습니다.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "업로드에 실패했습니다.";
      labToast.error("문서 첨부 실패", message);
    } finally {
      abortRef.current = null;
      setUploading(null);
    }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    try {
      await removeDocument(docId);
      labToast.success("문서 삭제", `<b>${fileName}</b> 을(를) 삭제했습니다.`);
    } catch {
      labToast.error("문서 삭제 실패", "잠시 후 다시 시도해주세요.");
    }
  };

  const renderDocRow = (doc: ReceivingDocumentItem) => (
    <div
      key={doc.id}
      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate text-[13px] font-semibold text-slate-900">{doc.fileName}</span>
          <span className="shrink-0 text-[11px] text-slate-500">{formatSize(doc.sizeBytes)}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{formatAttachedLine(doc)}</p>
      </div>
      <button
        type="button"
        onClick={() => handleDelete(doc.id, doc.fileName)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
        aria-label={`${doc.fileName} 삭제`}
      >
        <Trash2 className="h-3 w-3" />
        삭제
      </button>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/45" onClick={() => onOpenChange(false)} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="문서 첨부"
        className="relative z-10 flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-xl"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-slate-900">문서 첨부</h2>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">
              {rb.receivingNumber}
              {rb.lineReceipts?.[0]?.itemName ? ` · ${rb.lineReceipts[0].itemName} 입고 건` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* 발주 미해석 = 업로드 불가 사유 명시(dead button 0) */}
          {!isResolving && !orderId && (
            <div className="flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3.5 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-700" />
              <p className="text-[12px] leading-relaxed text-yellow-800">
                이 입고 건이 발주와 연결되어 있지 않아 문서를 첨부할 수 없습니다. 발주 연결 후 다시
                시도해주세요.
              </p>
            </div>
          )}

          {/* 1) 거래명세서 */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">거래명세서</h3>
            </div>
            {isLoading ? (
              <div className="h-14 animate-pulse rounded-xl bg-slate-50" aria-busy="true" />
            ) : invoiceDocs.length > 0 ? (
              <div className="space-y-1.5">{invoiceDocs.map(renderDocRow)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-[12px] text-slate-500">
                첨부된 거래명세서가 없습니다.
              </p>
            )}
            <input
              ref={invoiceInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
              onChange={(e) => {
                void handlePick(e.target.files?.[0], "invoice");
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 text-xs"
              disabled={!canUpload}
              onClick={() => invoiceInputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              거래명세서 첨부
            </Button>
          </section>

          {/* 2) MSDS — 품목 단위 문서(연동 표시 전용) */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">MSDS</h3>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-600">
              MSDS는 품목 문서에서 자동 연동됩니다(매 입고 재첨부 불필요). 품목별 등록 상태는 품목
              상세의 안전 문서에서 확인·교체할 수 있습니다.
            </p>
          </section>

          {/* 3) 성적서(CoA) — lot 결속은 입고 확정 이후(T2) */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">성적서 (CoA)</h3>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-600">
              CoA는 Lot 단위 문서라 <b>입고 확정(검수 완료) 후</b> 해당 Lot에 첨부됩니다. 검수 중
              첨부는 검수 화면에서 제공될 예정입니다.
            </p>
          </section>

          {/* 4) 기타 문서 */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">기타 문서</h3>
            </div>
            {isLoading ? (
              <div className="h-14 animate-pulse rounded-xl bg-slate-50" aria-busy="true" />
            ) : etcDocs.length > 0 ? (
              <div className="space-y-1.5">{etcDocs.map(renderDocRow)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-[12px] text-slate-500">
                첨부된 기타 문서가 없습니다.
              </p>
            )}
            <input
              ref={etcInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.csv"
              onChange={(e) => {
                void handlePick(e.target.files?.[0], "etc");
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 text-xs"
              disabled={!canUpload}
              onClick={() => etcInputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              파일 선택
            </Button>
          </section>

          {/* 업로드 진행률 + 취소 */}
          {uploading && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-blue-800">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="truncate">업로드 중 {uploading.percent}% · {uploading.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => abortRef.current?.()}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700"
                >
                  취소
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${uploading.percent}%` }}
                />
              </div>
            </div>
          )}

          {isError && (
            <p className="text-[12px] text-slate-500">
              문서 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
            </p>
          )}
        </div>

        {/* 푸터 — 카운트는 레코드 파생 */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            첨부 {attachedCount} · 업로드 중 {uploadingCount} · 품목 연동 MSDS
          </span>
          <Button size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            완료
          </Button>
        </div>
      </div>
    </div>
  );
}
