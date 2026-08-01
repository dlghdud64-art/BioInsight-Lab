"use client";

/**
 * §receiving-doc-attach-canonical (T1) — 모바일 문서 첨부 시트 (canonical 배선).
 *
 * 데스크톱 모달(receiving-doc-attach-modal)과 동일 계약 — 두 surface 동등성 유지.
 *   - "추가" front-only 제거: 파일 선택기 → 진행률(취소) → **서버 2xx 확인 후에만** 첨부됨.
 *   - 데모 seed 첨부 플래그 참조 0 — 상태는 문서 레코드에서만 파생.
 *   - MSDS = 품목 단위 문서 자동 연동(재첨부 불필요) 안내.
 *   - CoA = Lot 단위라 입고 확정(검수 완료) 후 첨부 — 사유 명시(가짜 버튼 금지).
 *   - 발주(Order) 미해석 시 업로드 비활성 + 사유 표기(dead button 0).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, CheckCircle2, AlertTriangle, Upload, X, Loader2, Trash2 } from "lucide-react";
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
  rb: ReceivingBatchContract | null;
  onClose: () => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatAttachedLine(doc: ReceivingDocumentItem): string {
  const d = new Date(doc.uploadedAt);
  const date = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  return [date, doc.uploadedBy].filter(Boolean).join(" ") + (date ? " 첨부" : "");
}

export function MobileDocAttachSheet({ open, rb, onClose }: Props) {
  const { orderId, isResolving } = useResolvedOrderId(open && rb ? rb.poId : null);
  const { documents, isLoading, isError, removeDocument, invalidate } = useReceivingDocuments(
    open ? orderId : null,
  );

  const [uploading, setUploading] = useState<{ name: string; percent: number } | null>(null);
  const abortRef = useRef<null | (() => void)>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingType, setPendingType] = useState<"invoice" | "etc">("invoice");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const invoiceDocs = useMemo(() => documents.filter((d) => d.docType === "invoice"), [documents]);
  const etcDocs = useMemo(() => documents.filter((d) => d.docType !== "invoice"), [documents]);
  const canUpload = Boolean(orderId) && !uploading;

  const openPicker = (docType: "invoice" | "etc") => {
    setPendingType(docType);
    fileInputRef.current?.click();
  };

  const handlePick = async (file: File | undefined) => {
    if (!file || !orderId) return;
    setUploading({ name: file.name, percent: 0 });
    const { promise, abort } = uploadReceivingDocumentWithProgress({
      orderId,
      file,
      docType: pendingType,
      onProgress: (percent) => setUploading((prev) => (prev ? { ...prev, percent } : prev)),
    });
    abortRef.current = abort;
    try {
      await promise; // 서버 확인 후에만 성공.
      await invalidate();
      labToast.success("문서 첨부 완료", `<b>${file.name}</b> 이(가) 첨부되었습니다.`);
    } catch (err) {
      labToast.error(
        "문서 첨부 실패",
        err instanceof Error ? err.message : "업로드에 실패했습니다.",
      );
    } finally {
      abortRef.current = null;
      setUploading(null);
    }
  };

  const renderDoc = (doc: ReceivingDocumentItem) => (
    <div
      key={doc.id}
      className="flex items-start justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate text-[13px] font-semibold text-slate-900">{doc.fileName}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {formatSize(doc.sizeBytes)} · {formatAttachedLine(doc)}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await removeDocument(doc.id);
            labToast.success("문서 삭제", `<b>${doc.fileName}</b> 을(를) 삭제했습니다.`);
          } catch {
            labToast.error("문서 삭제 실패", "잠시 후 다시 시도해주세요.");
          }
        }}
        className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] text-slate-600"
        aria-label={`${doc.fileName} 삭제`}
      >
        <Trash2 className="h-3 w-3" />
        삭제
      </button>
    </div>
  );

  if (!rb) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-200 md:hidden ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="문서 첨부"
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[18px] border-t border-slate-200 bg-white"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-slate-900">문서 첨부</h2>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">{rb.receivingNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] rounded-lg px-2 text-slate-400"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
          {!isResolving && !orderId && (
            <div className="flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-700" />
              <p className="text-[12px] leading-relaxed text-yellow-800">
                발주와 연결되지 않은 입고 건이라 문서를 첨부할 수 없습니다.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.csv"
            onChange={(e) => {
              void handlePick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">거래명세서</h3>
            </div>
            {isLoading ? (
              <div className="h-14 animate-pulse rounded-xl bg-slate-50" aria-busy="true" />
            ) : invoiceDocs.length > 0 ? (
              <div className="space-y-1.5">{invoiceDocs.map(renderDoc)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-[12px] text-slate-500">
                첨부된 거래명세서가 없습니다.
              </p>
            )}
            <button
              type="button"
              disabled={!canUpload}
              onClick={() => openPicker("invoice")}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              거래명세서 첨부
            </button>
          </section>

          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">MSDS</h3>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
              MSDS는 품목 문서에서 자동 연동됩니다(매 입고 재첨부 불필요).
            </p>
          </section>

          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">성적서 (CoA)</h3>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
              CoA는 Lot 단위 문서라 <b>입고 확정(검수 완료) 후</b> 해당 Lot에 첨부됩니다.
            </p>
          </section>

          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[12px] font-bold text-slate-700">기타 문서</h3>
            </div>
            {isLoading ? (
              <div className="h-14 animate-pulse rounded-xl bg-slate-50" aria-busy="true" />
            ) : etcDocs.length > 0 ? (
              <div className="space-y-1.5">{etcDocs.map(renderDoc)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-[12px] text-slate-500">
                첨부된 기타 문서가 없습니다.
              </p>
            )}
            <button
              type="button"
              disabled={!canUpload}
              onClick={() => openPicker("etc")}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              파일 선택
            </button>
          </section>

          {uploading && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-blue-800">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="truncate">업로드 중 {uploading.percent}%</span>
                </span>
                <button
                  type="button"
                  onClick={() => abortRef.current?.()}
                  className="min-h-[36px] shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-semibold text-blue-700"
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
            <p className="text-[12px] text-slate-500">문서 목록을 불러오지 못했습니다.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            첨부 {documents.length} · 업로드 중 {uploading ? 1 : 0} · 품목 연동 MSDS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
